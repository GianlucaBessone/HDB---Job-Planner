'use client';

import React, { useState, useMemo } from 'react';
import {
    Building2,
    Calendar,
    Clock,
    Activity,
    Timer,
    Users,
    ShieldCheck,
    FileText,
    CheckCircle2,
    PlayCircle,
    AlertTriangle,
    AlarmClock,
    ClipboardList,
    BarChart2,
    Filter,
    RotateCcw,
    CalendarRange,
    Check
} from 'lucide-react';
import ReportPrintButton from '@/components/ReportPrintButton';
import { formatDate } from '@/lib/formatDate';

interface ProjectReportViewProps {
    project: any;
}

export default function ProjectReportView({ project }: ProjectReportViewProps) {
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');

    // Quick presets for date filters
    const handleSetThisMonth = () => {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        setStartDate(firstDay);
        setEndDate(lastDay);
    };

    const handleSetLastMonth = () => {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
        const lastDay = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
        setStartDate(firstDay);
        setEndDate(lastDay);
    };

    const handleClearFilter = () => {
        setStartDate('');
        setEndDate('');
    };

    // Filter timeEntries based on date range
    const filteredTimeEntries = useMemo(() => {
        if (!project.timeEntries) return [];
        return project.timeEntries.filter((entry: any) => {
            const entryDate = entry.fecha ? new Date(entry.fecha).toISOString().split('T')[0] : '';
            if (startDate && entryDate < startDate) return false;
            if (endDate && entryDate > endDate) return false;
            return true;
        });
    }, [project.timeEntries, startDate, endDate]);

    // Filter clientDelays based on date range
    const filteredClientDelays = useMemo(() => {
        if (!project.clientDelays) return [];
        return project.clientDelays.filter((delay: any) => {
            const delayDate = delay.fecha ? new Date(delay.fecha).toISOString().split('T')[0] : '';
            if (startDate && delayDate < startDate) return false;
            if (endDate && delayDate > endDate) return false;
            return true;
        });
    }, [project.clientDelays, startDate, endDate]);

    // Dynamic KPI Calculations
    const hasClientStr = project.client?.nombre || project.cliente || 'Sin cliente';
    const totalDelaysHours = filteredClientDelays.reduce((acc: number, d: any) => acc + d.duracion, 0);
    const totalRealHours = filteredTimeEntries.reduce((acc: number, t: any) => acc + (t.isExtra ? t.horasTrabajadas * 2 : t.horasTrabajadas), 0);

    const estimatedHours = project.proyectoFijo ? totalRealHours : (project.horasEstimadas || 0);

    const IPT = estimatedHours > 0 && totalRealHours > 0
        ? (estimatedHours / totalRealHours).toFixed(2)
        : estimatedHours > 0 ? 'N/A' : 'N/A';

    const savedHours = estimatedHours - totalRealHours;

    const delayImpactPct = totalRealHours > 0
        ? ((totalDelaysHours / totalRealHours) * 100).toFixed(1)
        : '0.0';

    // Agrupar por operador
    const operatorMap: Record<string, { nombre: string; horas: number }> = {};
    filteredTimeEntries.forEach((entry: any) => {
        if (!operatorMap[entry.operatorId]) {
            operatorMap[entry.operatorId] = { nombre: entry.operator?.nombreCompleto || 'Desconocido', horas: 0 };
        }
        operatorMap[entry.operatorId].horas += entry.isExtra ? entry.horasTrabajadas * 2 : entry.horasTrabajadas;
    });

    // Agrupar demoras por área
    const delaysByArea: Record<string, number> = {};
    filteredClientDelays.forEach((d: any) => {
        delaysByArea[d.area] = (delaysByArea[d.area] || 0) + d.duracion;
    });

    const operatorArray = Object.values(operatorMap);
    const delaysArray = Object.entries(delaysByArea).map(([area, horas]) => ({ area, horas }));

    // Status badge config
    const STATUS_CONFIG: Record<string, { label: string; textColor: string; Icon: React.ElementType }> = {
        por_hacer:   { label: 'POR HACER',   textColor: 'text-slate-400 dark:text-slate-500',  Icon: ClipboardList },
        planificado: { label: 'PLANIFICADO', textColor: 'text-blue-500',   Icon: BarChart2 },
        activo:      { label: 'EN CURSO',    textColor: 'text-indigo-500', Icon: PlayCircle },
        en_riesgo:   { label: 'EN RIESGO',   textColor: 'text-amber-500',  Icon: AlertTriangle },
        atrasado:    { label: 'ATRASADO',    textColor: 'text-rose-500',   Icon: AlarmClock },
        finalizado:  { label: 'FINALIZADO',  textColor: 'text-emerald-500',Icon: CheckCircle2 },
    };
    const statusCfg = STATUS_CONFIG[project.estado] ?? {
        label: project.estado?.toUpperCase() ?? 'SIN ESTADO',
        textColor: 'text-slate-400 dark:text-slate-500',
        Icon: ShieldCheck
    };
    const StatusIcon = statusCfg.Icon;

    // Filter active flag
    const isFilterActive = Boolean(startDate || endDate);

    // Project object to pass to PDF (with filtered timeEntries & clientDelays)
    const filteredProjectForPDF = useMemo(() => ({
        ...project,
        timeEntries: filteredTimeEntries,
        clientDelays: filteredClientDelays,
    }), [project, filteredTimeEntries, filteredClientDelays]);

    return (
        <div className="min-h-screen bg-background text-foreground/50 py-8 print:p-0 print:bg-white text-slate-800 dark:text-slate-100 font-sans mx-auto max-w-[950px] px-4 md:px-6">
            
            {/* Top Control Bar */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 print:hidden">
                <div>
                    {project.proyectoFijo && (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-bold shadow-sm">
                            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                            Proyecto de Tipo Fijo
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-3 self-end md:self-auto">
                    <ReportPrintButton
                        project={filteredProjectForPDF}
                        totalRealHours={totalRealHours}
                        savedHours={savedHours}
                        IPT={IPT}
                        operatorMap={operatorArray}
                        delaysByArea={delaysArray}
                        delayImpactPct={delayImpactPct}
                        clientDelays={filteredClientDelays}
                        dateRange={isFilterActive ? { start: startDate, end: endDate } : undefined}
                    />
                </div>
            </div>

            {/* Dynamic Date Filter Bar (Only for Proyectos Fijos or available when needed) */}
            {project.proyectoFijo && (
                <div className="mb-6 p-5 bg-card text-card-foreground rounded-2xl border border-indigo-100 dark:border-indigo-900/50 shadow-sm print:hidden">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
                                <CalendarRange className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                                    Filtro por Período de Ejecución
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Ajusta las fechas para calcular las horas y generar el informe en base al rango seleccionado.
                                </p>
                            </div>
                        </div>

                        {/* Date Inputs & Quick Filters */}
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-2 bg-background dark:bg-slate-900/60 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                                <span className="font-bold text-slate-500 px-1">Desde:</span>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="bg-transparent text-slate-800 dark:text-slate-200 font-semibold outline-none cursor-pointer"
                                />
                            </div>
                            <div className="flex items-center gap-2 bg-background dark:bg-slate-900/60 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                                <span className="font-bold text-slate-500 px-1">Hasta:</span>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="bg-transparent text-slate-800 dark:text-slate-200 font-semibold outline-none cursor-pointer"
                                />
                            </div>

                            {/* Quick Presets */}
                            <div className="flex items-center gap-1.5">
                                <button
                                    onClick={handleSetThisMonth}
                                    type="button"
                                    className="px-2.5 py-1.5 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                                >
                                    Este Mes
                                </button>
                                <button
                                    onClick={handleSetLastMonth}
                                    type="button"
                                    className="px-2.5 py-1.5 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                                >
                                    Mes Pasado
                                </button>
                                {isFilterActive && (
                                    <button
                                        onClick={handleClearFilter}
                                        type="button"
                                        title="Ver todo"
                                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 transition-colors"
                                    >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                        Limpiar
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {isFilterActive && (
                        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-indigo-600 dark:text-indigo-400 font-semibold">
                            <span>
                                Periodo activo: {startDate ? formatDate(startDate) : 'Inicio'} → {endDate ? formatDate(endDate) : 'Hoy'}
                            </span>
                            <span>
                                {filteredTimeEntries.length} registros de tiempo ({totalRealHours.toFixed(1)}h)
                            </span>
                        </div>
                    )}
                </div>
            )}

            {/* ── Main Report Content Card ── */}
            <div id="report-content" className="bg-card text-card-foreground p-8 md:p-14 md:rounded-[2.5rem] shadow-sm print:shadow-none print:p-0">

                {/* ── Header ── */}
                <div className="flex flex-col md:flex-row justify-between items-start border-b-2 border-slate-900 dark:border-slate-700 pb-8 mb-8 gap-4">
                    <div>
                        <h1 className="text-4xl font-black text-slate-900 dark:text-slate-50 tracking-tighter mb-2">
                            Reporte de Proyecto
                        </h1>
                        <div className="flex items-center gap-2">
                            <StatusIcon className={`w-4 h-4 mr-1 ${statusCfg.textColor}`} />
                            <span className={`text-sm font-bold uppercase tracking-widest ${statusCfg.textColor}`}>
                                {statusCfg.label}
                            </span>
                            {project.proyectoFijo && (
                                <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 tracking-wider">
                                    Fijo
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="text-left md:text-right flex flex-col md:items-end gap-1">
                        <h2 className="text-2xl font-black text-indigo-600 tracking-tight leading-none">
                            {project.nombre}
                        </h2>
                        <div className="flex items-center md:justify-end text-slate-500 dark:text-slate-400">
                            <span className="text-sm font-bold">{hasClientStr}</span>
                            <Building2 className="w-4 h-4 ml-1.5" />
                        </div>
                        {/* Fechas del proyecto */}
                        <div className="flex items-center gap-3 mt-1 text-xs font-bold text-slate-400 dark:text-slate-500">
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
                    <div className="bg-background text-foreground/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col justify-center items-center text-center">
                        <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Hs Estimadas</p>
                        <p className="text-2xl font-black text-slate-800 dark:text-slate-100">
                            {project.proyectoFijo ? `${totalRealHours.toFixed(1)}h` : `${project.horasEstimadas}h`}
                        </p>
                    </div>
                    <div className="bg-background text-foreground/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col justify-center items-center text-center">
                        <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Hs Reales</p>
                        <p className={`text-2xl font-black ${totalRealHours > estimatedHours ? 'text-rose-500' : 'text-emerald-500'}`}>
                            {totalRealHours.toFixed(1)}h
                        </p>
                    </div>
                    <div className="bg-background text-foreground/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col justify-center items-center text-center">
                        <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Ahorro / Desvío</p>
                        <p className={`text-2xl font-black ${savedHours >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {savedHours > 0 ? '+' : ''}{savedHours.toFixed(1)}h
                        </p>
                    </div>
                    <div className="bg-indigo-50 dark:bg-indigo-950/40 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 flex flex-col justify-center items-center text-center">
                        <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">Eficiencia (IPT)</p>
                        <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{IPT}</p>
                    </div>
                    <div className="bg-amber-50 dark:bg-amber-950/40 p-4 rounded-2xl border border-amber-200 dark:border-amber-900/40 flex flex-col justify-center items-center text-center">
                        <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest mb-1">Carga Demoras</p>
                        <p className="text-2xl font-black text-amber-500">{delayImpactPct}%</p>
                    </div>
                    <div className="bg-emerald-50 dark:bg-emerald-950/40 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-900/40 flex flex-col justify-center items-center text-center">
                        <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-1">Avance Técnico</p>
                        <p className="text-base font-black text-emerald-600 dark:text-emerald-400">
                            {project.checklistItems?.filter((i: any) => i.completed && !i.excluded).length || 0} / {project.checklistItems?.filter((i: any) => !i.excluded).length || 0}
                        </p>
                    </div>
                </div>

                {/* ── Observaciones ── */}
                {project.observaciones && (
                    <div className="mb-8 p-5 bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50 rounded-2xl">
                        <div className="flex items-center gap-2 mb-2">
                            <FileText className="w-4 h-4 text-amber-500" />
                            <h3 className="text-xs font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest">Observaciones del Proyecto</h3>
                        </div>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">{project.observaciones}</p>
                    </div>
                )}

                {/* ── Resúmenes laterales ── */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10 border-b border-slate-100 dark:border-slate-800 pb-10 mb-10">
                    {/* Operadores */}
                    <div>
                        <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center">
                            <Users className="w-5 h-5 text-indigo-500 mr-2.5" />
                            Resumen por Operador
                        </h3>
                        <div className="space-y-3">
                            {operatorArray.map((op, idx) => {
                                const pct = totalRealHours > 0 ? Math.min(op.horas / totalRealHours, 1) * 100 : 0;
                                return (
                                    <div key={idx}>
                                        <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                                            <span>{op.nombre}</span>
                                            <span>{op.horas.toFixed(1)}h</span>
                                        </div>
                                        <div className="h-2 bg-muted text-muted-foreground/50 rounded-full overflow-hidden">
                                            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                            {operatorArray.length === 0 && (
                                <p className="text-sm font-bold text-slate-400 dark:text-slate-500 italic">
                                    No hay registros de tiempo en el período seleccionado.
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Demoras por area */}
                    <div>
                        <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center">
                            <Timer className="w-5 h-5 text-amber-500 mr-2.5" />
                            Demoras del Cliente:&nbsp;<span className="text-amber-500">{totalDelaysHours}h</span>
                            <span className="ml-2 text-xs font-bold text-slate-400 dark:text-slate-500">({delayImpactPct}% carga)</span>
                        </h3>
                        <div className="space-y-3">
                            {delaysArray.map(({ area, horas }, idx) => {
                                const pct = totalDelaysHours > 0 ? (horas / totalDelaysHours) * 100 : 0;
                                return (
                                    <div key={idx}>
                                        <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                                            <span>{area}</span>
                                            <span className="text-amber-500">{horas}h</span>
                                        </div>
                                        <div className="h-2 bg-muted text-muted-foreground/50 rounded-full overflow-hidden">
                                            <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                            {delaysArray.length === 0 && (
                                <p className="text-sm font-bold text-slate-400 dark:text-slate-500 italic">
                                    Sin demoras registradas en el período seleccionado.
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Tablas de Detalle ── */}
                <div className="space-y-10">

                    {/* Desglose Tiempos Operativos */}
                    <div>
                        <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                            <Clock className="w-4 h-4 text-indigo-500" />
                            Desglose de Tiempos Operativos {isFilterActive && <span className="text-xs font-normal text-slate-400">({filteredTimeEntries.length} entradas)</span>}
                        </h3>
                        {filteredTimeEntries.length === 0 ? (
                            <p className="text-sm text-slate-400 dark:text-slate-500 italic">
                                Sin registros de tiempo confirmados para este período.
                            </p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-200 dark:border-slate-700">
                                            <th className="py-2 pr-4 font-bold text-slate-400 dark:text-slate-500 uppercase text-[10px] tracking-widest">Fecha</th>
                                            <th className="py-2 pr-4 font-bold text-slate-400 dark:text-slate-500 uppercase text-[10px] tracking-widest">Operador</th>
                                            <th className="py-2 pr-4 font-bold text-slate-400 dark:text-slate-500 uppercase text-[10px] tracking-widest">Horario</th>
                                            <th className="py-2 text-right font-bold text-slate-400 dark:text-slate-500 uppercase text-[10px] tracking-widest">Hs</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredTimeEntries.map((e: any) => (
                                            <tr key={e.id} className="border-b border-slate-100 dark:border-slate-800/60 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                                <td className="py-2 pr-4">{formatDate(e.fecha)}</td>
                                                <td className="py-2 pr-4">
                                                    {e.operator?.nombreCompleto || 'Desconocido'}
                                                    {e.isExtra && <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest ml-1.5">(Extra)</span>}
                                                    {e.isDevolucion && <span className="text-[9px] font-black text-purple-500 uppercase tracking-widest ml-1.5">(Devolución)</span>}
                                                </td>
                                                <td className="py-2 pr-4 font-bold">{e.horaIngreso} → {e.horaEgreso}</td>
                                                <td className="py-2 text-right font-bold text-slate-700 dark:text-slate-200">
                                                    {((e.isExtra ? e.horasTrabajadas * 2 : e.horasTrabajadas) || 0).toFixed(1)}h
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Detalle Demoras Externas */}
                    {filteredClientDelays.length > 0 && (
                        <div>
                            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                                <Timer className="w-4 h-4 text-amber-500" />
                                Detalle de Demoras Externas
                            </h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-200 dark:border-slate-700">
                                            <th className="py-2 pr-3 font-bold text-slate-400 dark:text-slate-500 uppercase text-[10px] tracking-widest">Fecha</th>
                                            <th className="py-2 pr-3 font-bold text-slate-400 dark:text-slate-500 uppercase text-[10px] tracking-widest">Área</th>
                                            <th className="py-2 pr-3 font-bold text-slate-400 dark:text-slate-500 uppercase text-[10px] tracking-widest">Resp. Área</th>
                                            <th className="py-2 pr-3 font-bold text-slate-400 dark:text-slate-500 uppercase text-[10px] tracking-widest">Motivo</th>
                                            <th className="py-2 font-bold text-slate-400 dark:text-slate-500 uppercase text-[10px] tracking-widest text-right">Hs</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredClientDelays.map((d: any) => (
                                            <tr key={d.id} className="border-b border-slate-100 dark:border-slate-800/60 text-slate-600 dark:text-slate-300 font-medium">
                                                <td className="py-2 pr-3">{formatDate(d.fecha)}</td>
                                                <td className="py-2 pr-3 text-amber-600 font-bold text-xs uppercase">{d.area}</td>
                                                <td className="py-2 pr-3 text-slate-500 dark:text-slate-400 text-xs">{d.responsableArea || '—'}</td>
                                                <td className="py-2 pr-3 italic max-w-[200px] truncate" title={d.motivo}>&quot;{d.motivo}&quot;</td>
                                                <td className="py-2 text-right font-black text-amber-500">{d.duracion}h</td>
                                            </tr>
                                        ))}
                                        <tr className="border-t-2 border-slate-200 dark:border-slate-700 font-black">
                                            <td colSpan={4} className="py-2 pr-3 text-right text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500">Total Demoras:</td>
                                            <td className="py-2 text-right text-amber-500">{totalDelaysHours}h</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Checklist Técnico */}
                    <div>
                        <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-emerald-500" />
                            Avance Técnico (Checklist)
                        </h3>
                        {(!project.checklistItems || project.checklistItems.filter((i: any) => !i.excluded).length === 0) ? (
                            <p className="text-sm text-slate-400 dark:text-slate-500 italic">Sin tareas documentadas en el checklist.</p>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {project.checklistItems.filter((i: any) => !i.excluded).map((item: any) => (
                                    <div key={item.id} className={`p-4 rounded-2xl border flex items-start gap-4 transition-all ${item.completed ? 'bg-emerald-50/40 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/40' : 'bg-slate-50/50 border-slate-100 dark:bg-slate-900/40 dark:border-slate-800'}`}>
                                        <div className={`mt-0.5 shrink-0 w-6 h-6 rounded-xl border-2 flex items-center justify-center ${item.completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-200 dark:border-slate-700 bg-card text-card-foreground'}`}>
                                            {item.completed && <Activity className="w-3 h-3" />}
                                        </div>
                                        <div>
                                            <p className={`text-sm font-bold leading-snug ${item.completed ? 'text-emerald-900 dark:text-emerald-300' : 'text-slate-600 dark:text-slate-300'}`}>
                                                {item.description}
                                            </p>
                                            <div className="flex items-center gap-2 mt-1.5 font-bold uppercase tracking-widest text-[9px]">
                                                <span className="px-2 py-0.5 rounded-lg bg-card text-card-foreground border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500">
                                                    {item.tag}
                                                </span>
                                                <span className={item.completed ? 'text-emerald-500' : 'text-slate-400 dark:text-slate-500'}>
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
                <div className="mt-16 pt-6 border-t border-slate-200 dark:border-slate-700 text-center text-xs font-bold text-slate-400 dark:text-slate-500">
                    <p>Reporte Oficial | Generado automáticamente por HDB SGI el {formatDate(new Date())}</p>
                </div>
            </div>
        </div>
    );
}
