import React, { useState, useEffect, useMemo } from 'react';
import { 
    X, AlertTriangle, Download, Copy, Check, Table2, Clock, 
    BarChart2, Search, FileText, CheckCircle2, Hash, Calendar, Type as TypeIcon, Info
} from 'lucide-react';
import { showToast } from '@/components/Toast';

export default function DatasetPreviewModal({ dataset, onClose }: any) {
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [durationMs, setDurationMs] = useState<number | null>(null);
    const [copiedJson, setCopiedJson] = useState(false);
    const [copiedMd, setCopiedMd] = useState(false);
    const [activeTab, setActiveTab] = useState<'tabla' | 'perfil'>('tabla');
    const [searchFilter, setSearchFilter] = useState('');

    useEffect(() => {
        const fetchPreview = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch(`/api/datasets/${dataset.id}/preview`, { method: 'POST' });
                const data = await res.json();
                if (res.ok) {
                    setPreviewData(data.datos || []);
                    setDurationMs(data.duracionMs || null);
                } else {
                    setError(data.error);
                }
            } catch (err: any) {
                setError(err.message || 'Error desconocido');
            } finally {
                setLoading(false);
            }
        };
        fetchPreview();
    }, [dataset.id]);

    const columns = useMemo(() => {
        if (!previewData || previewData.length === 0) return [];
        return Object.keys(previewData[0]);
    }, [previewData]);

    // Data profiling metrics for Data Analysis
    const profiling = useMemo(() => {
        if (!previewData || previewData.length === 0 || columns.length === 0) return [];
        const totalRows = previewData.length;

        return columns.map(col => {
            let nullCount = 0;
            const values: any[] = [];
            const distinctSet = new Set();
            let numValues: number[] = [];
            let dateValues: number[] = [];

            for (const row of previewData) {
                const val = row[col];
                if (val === null || val === undefined || val === '') {
                    nullCount++;
                } else {
                    distinctSet.add(val);
                    values.push(val);
                    if (typeof val === 'number') {
                        numValues.push(val);
                    } else if (typeof val === 'string' && !isNaN(Number(val)) && val.trim() !== '') {
                        numValues.push(Number(val));
                    }
                    if (val instanceof Date) {
                        dateValues.push(val.getTime());
                    } else if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) {
                        const parsed = Date.parse(val);
                        if (!isNaN(parsed)) dateValues.push(parsed);
                    }
                }
            }

            const nonNullCount = totalRows - nullCount;
            const completenessPct = Math.round((nonNullCount / totalRows) * 100);

            // Infer data type
            let tipo = 'string';
            if (numValues.length > 0 && numValues.length === values.length) {
                tipo = 'number';
            } else if (dateValues.length > 0 && dateValues.length === values.length) {
                tipo = 'date';
            } else if (values.every(v => typeof v === 'boolean')) {
                tipo = 'boolean';
            } else if (values.some(v => typeof v === 'object')) {
                tipo = 'json';
            }

            // Stats
            let min: any = null;
            let max: any = null;
            let avg: any = null;
            let sum: any = null;

            if (tipo === 'number' && numValues.length > 0) {
                min = Math.min(...numValues);
                max = Math.max(...numValues);
                sum = numValues.reduce((a, b) => a + b, 0);
                avg = Number((sum / numValues.length).toFixed(2));
            } else if (tipo === 'date' && dateValues.length > 0) {
                min = new Date(Math.min(...dateValues)).toLocaleDateString();
                max = new Date(Math.max(...dateValues)).toLocaleDateString();
            }

            return {
                column: col,
                tipo,
                totalRows,
                nonNullCount,
                nullCount,
                completenessPct,
                cardinality: distinctSet.size,
                min,
                max,
                avg,
                sum,
                sampleValues: values.slice(0, 3).map(v => String(v)).join(', ')
            };
        });
    }, [previewData, columns]);

    // Filtered rows for table search
    const filteredRows = useMemo(() => {
        if (!searchFilter.trim()) return previewData;
        const q = searchFilter.toLowerCase();
        return previewData.filter(row => 
            columns.some(col => {
                const val = row[col];
                if (val === null || val === undefined) return false;
                return String(val).toLowerCase().includes(q);
            })
        );
    }, [previewData, columns, searchFilter]);

    // CSV Download with UTF-8 BOM (\uFEFF) for Excel compatibility
    const downloadCSV = () => {
        if (previewData.length === 0) return;
        const header = columns.join(',');
        const rows = previewData.map(row => 
            columns.map(col => {
                const val = row[col];
                if (val === null || val === undefined) return '""';
                const str = String(val).replace(/"/g, '""');
                return `"${str}"`;
            }).join(',')
        );
        const csvContent = '\uFEFF' + [header, ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${dataset.codigoDataset || 'dataset'}_muestra.csv`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('CSV descargado con codificación UTF-8 compatible con Excel', 'success');
    };

    const copyJSON = () => {
        if (previewData.length === 0) return;
        navigator.clipboard.writeText(JSON.stringify(previewData, null, 2));
        setCopiedJson(true);
        setTimeout(() => setCopiedJson(false), 2000);
        showToast('JSON copiado al portapapeles', 'success');
    };

    const copyMarkdown = () => {
        if (previewData.length === 0) return;
        const header = `| ${columns.join(' | ')} |`;
        const separator = `| ${columns.map(() => '---').join(' | ')} |`;
        const rows = previewData.slice(0, 25).map(row => 
            `| ${columns.map(col => String(row[col] ?? '')).join(' | ')} |`
        );
        const md = [header, separator, ...rows].join('\n');
        navigator.clipboard.writeText(md);
        setCopiedMd(true);
        setTimeout(() => setCopiedMd(false), 2000);
        showToast('Tabla Markdown copiada al portapapeles', 'success');
    };

    return (
        <div className="fixed inset-0 bg-slate-950/50 z-[200] flex items-center justify-center p-4">
            <div className="bg-card text-card-foreground rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 shrink-0 bg-slate-50/50 dark:bg-slate-900/40">
                    <div className="min-w-0 pr-4">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded uppercase font-mono">
                                {dataset.codigoDataset}
                            </span>
                            <span className="text-[11px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded uppercase">
                                Modo {dataset.modoConsulta || 'SQL'}
                            </span>
                            {durationMs !== null && (
                                <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded flex items-center gap-1">
                                    <Clock className="w-3 h-3" /> {durationMs} ms
                                </span>
                            )}
                        </div>
                        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 truncate" title={dataset.nombre}>
                            {dataset.nombre}
                        </h2>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        {previewData.length > 0 && (
                            <>
                                <button 
                                    type="button"
                                    onClick={copyMarkdown}
                                    className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 transition-colors hidden sm:flex"
                                    title="Copiar muestra como Markdown"
                                >
                                    {copiedMd ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <FileText className="w-3.5 h-3.5" />}
                                    <span>MD</span>
                                </button>
                                <button 
                                    type="button"
                                    onClick={copyJSON}
                                    className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 transition-colors"
                                    title="Copiar JSON completo"
                                >
                                    {copiedJson ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                    <span>JSON</span>
                                </button>
                                <button 
                                    type="button"
                                    onClick={downloadCSV}
                                    className="h-8 px-3 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-xs font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/60 flex items-center gap-1.5 transition-colors"
                                    title="Exportar a CSV con BOM UTF-8"
                                >
                                    <Download className="w-3.5 h-3.5" />
                                    <span>Exportar CSV</span>
                                </button>
                            </>
                        )}
                        <button 
                            type="button"
                            onClick={onClose} 
                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-600"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Sub-header Navigation Tabs */}
                {previewData.length > 0 && (
                    <div className="px-5 py-2.5 bg-slate-50/70 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-1 bg-slate-200/70 dark:bg-slate-800 p-0.5 rounded-lg">
                            <button
                                type="button"
                                onClick={() => setActiveTab('tabla')}
                                className={`px-3 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
                                    activeTab === 'tabla'
                                        ? 'bg-card text-foreground shadow-xs text-indigo-600 dark:text-indigo-400'
                                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                                }`}
                            >
                                <Table2 className="w-3.5 h-3.5" /> Tabla de Datos ({previewData.length})
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('perfil')}
                                className={`px-3 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
                                    activeTab === 'perfil'
                                        ? 'bg-card text-foreground shadow-xs text-indigo-600 dark:text-indigo-400'
                                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                                }`}
                            >
                                <BarChart2 className="w-3.5 h-3.5" /> Perfil Analítico ({columns.length} col)
                            </button>
                        </div>

                        {activeTab === 'tabla' && (
                            <div className="relative w-48 sm:w-64">
                                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input 
                                    type="text" 
                                    value={searchFilter}
                                    onChange={e => setSearchFilter(e.target.value)}
                                    placeholder="Filtrar datos..."
                                    className="w-full h-7 pl-8 pr-2 text-xs bg-card border border-slate-200 dark:border-slate-700 rounded-md outline-none focus:border-indigo-500"
                                />
                            </div>
                        )}
                    </div>
                )}
                
                {/* Content Area */}
                <div className="flex-1 overflow-auto bg-background text-foreground custom-scrollbar">
                    {loading ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 py-16">
                            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-3" />
                            <p className="text-xs">Consultando base de datos...</p>
                        </div>
                    ) : error ? (
                        <div className="p-8">
                            <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl p-4 flex gap-3 text-rose-700 dark:text-rose-400">
                                <AlertTriangle className="w-5 h-5 shrink-0" />
                                <div>
                                    <h3 className="font-bold mb-1 text-sm">Error al ejecutar la consulta</h3>
                                    <p className="text-xs break-all font-mono whitespace-pre-wrap">{error}</p>
                                </div>
                            </div>
                        </div>
                    ) : previewData.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-slate-400 text-xs py-16 italic">
                            La consulta no devolvió ningún registro.
                        </div>
                    ) : activeTab === 'tabla' ? (
                        /* Table View */
                        <table className="w-full text-left text-xs whitespace-nowrap">
                            <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0 shadow-xs z-10">
                                <tr>
                                    <th className="px-3 py-2 font-bold text-slate-500 uppercase text-[11px] tracking-wider w-10 text-center border-b border-slate-200 dark:border-slate-700">#</th>
                                    {columns.map(col => {
                                        const prof = profiling.find(p => p.column === col);
                                        return (
                                            <th key={col} className="px-3 py-2 font-bold text-slate-700 dark:text-slate-300 uppercase text-[11px] tracking-wider border-b border-slate-200 dark:border-slate-700">
                                                <div className="flex items-center gap-1.5">
                                                    <span>{col}</span>
                                                    {prof && (
                                                        <span className="text-[11px] px-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-500 font-mono font-normal">
                                                            {prof.tipo}
                                                        </span>
                                                    )}
                                                </div>
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {filteredRows.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20">
                                        <td className="px-3 py-1.5 text-[11px] text-slate-400 text-center border-r border-slate-100 dark:border-slate-800">{idx + 1}</td>
                                        {columns.map(col => {
                                            const val = row[col];
                                            const isDate = val instanceof Date || (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}T/));
                                            return (
                                                <td key={col} className="px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 font-mono">
                                                    {val === null ? <span className="text-slate-400 italic">null</span> :
                                                     isDate ? new Date(val).toLocaleString() :
                                                     typeof val === 'object' ? JSON.stringify(val) :
                                                     typeof val === 'number' ? <span className="text-indigo-600 dark:text-indigo-400 font-semibold">{val}</span> :
                                                     String(val)}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        /* Data Profiling / BI View */
                        <div className="p-6 space-y-6">
                            {/* Summary KPI Cards */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40">
                                    <div className="text-[11px] font-bold text-slate-400 uppercase">Filas Muestreadas</div>
                                    <div className="text-xl font-bold text-slate-800 dark:text-slate-100 mt-1">{previewData.length}</div>
                                </div>
                                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40">
                                    <div className="text-[11px] font-bold text-slate-400 uppercase">Total Columnas</div>
                                    <div className="text-xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">{columns.length}</div>
                                </div>
                                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40">
                                    <div className="text-[11px] font-bold text-slate-400 uppercase">Columnas Numéricas</div>
                                    <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                                        {profiling.filter(p => p.tipo === 'number').length}
                                    </div>
                                </div>
                                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40">
                                    <div className="text-[11px] font-bold text-slate-400 uppercase">Columnas de Fecha</div>
                                    <div className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                                        {profiling.filter(p => p.tipo === 'date').length}
                                    </div>
                                </div>
                            </div>

                            {/* Detailed Column Profiles Table */}
                            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-100 dark:bg-slate-800 text-[11px] uppercase font-bold text-slate-600 dark:text-slate-400">
                                        <tr>
                                            <th className="px-4 py-2.5">Columna</th>
                                            <th className="px-3 py-2.5">Tipo</th>
                                            <th className="px-4 py-2.5">Completitud (No Nulos)</th>
                                            <th className="px-3 py-2.5">Valores Únicos</th>
                                            <th className="px-4 py-2.5">Métricas / Resumen</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {profiling.map(p => (
                                            <tr key={p.column} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                                                <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-200 font-mono">
                                                    {p.column}
                                                </td>
                                                <td className="px-3 py-3">
                                                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase font-mono ${
                                                        p.tipo === 'number' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300' :
                                                        p.tipo === 'date' ? 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300' :
                                                        p.tipo === 'boolean' ? 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300' :
                                                        'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                                    }`}>
                                                        {p.tipo}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="space-y-1">
                                                        <div className="flex justify-between text-[11px] text-slate-500">
                                                            <span>{p.nonNullCount} de {p.totalRows} ({p.completenessPct}%)</span>
                                                            {p.nullCount > 0 && <span className="text-rose-500 font-semibold">{p.nullCount} nulls</span>}
                                                        </div>
                                                        <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                                            <div 
                                                                className={`h-full rounded-full ${p.completenessPct === 100 ? 'bg-emerald-500' : p.completenessPct > 70 ? 'bg-indigo-500' : 'bg-amber-500'}`}
                                                                style={{ width: `${p.completenessPct}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-3 font-semibold text-slate-700 dark:text-slate-300">
                                                    {p.cardinality} distintos
                                                </td>
                                                <td className="px-4 py-3 text-slate-600 dark:text-slate-400 text-[11px]">
                                                    {p.tipo === 'number' ? (
                                                        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono text-[11px]">
                                                            <span>Mín: <strong>{p.min}</strong></span>
                                                            <span>Máx: <strong>{p.max}</strong></span>
                                                            <span>Prom: <strong>{p.avg}</strong></span>
                                                            <span>Suma: <strong>{p.sum}</strong></span>
                                                        </div>
                                                    ) : p.tipo === 'date' ? (
                                                        <div className="font-mono text-[11px]">
                                                            <span>Rango: {p.min} → {p.max}</span>
                                                        </div>
                                                    ) : (
                                                        <div className="text-[11px] truncate max-w-xs text-slate-500" title={p.sampleValues}>
                                                            Ejemplos: {p.sampleValues || 'Vacío'}
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
