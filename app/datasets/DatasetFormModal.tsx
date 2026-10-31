'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
    X, Save, Database, Play, AlertTriangle, List, Clock, Table2, 
    ChevronRight, ChevronDown, CheckCircle2, Search, Download, 
    Copy, Check, Sparkles, Wand2, Eye, Key, Link2, Calendar, Hash, Type as TypeIcon,
    BarChart2, FileText
} from 'lucide-react';
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-sql';
import 'prismjs/themes/prism-tomorrow.css';
import { showToast } from '@/components/Toast';
import VisualBuilder from './VisualBuilder';
import { construirSQLDesdeVisual, DefinicionVisual } from '@/lib/datasetEngine';

// Business templates for HDB Job Planner
const TEMPLATES_HDB = [
    {
        nombre: 'Performance TPI de Proyectos',
        descripcion: 'Índice de productividad (horas estimadas vs consumidas) de proyectos activos.',
        sql: `SELECT 
    "id", 
    "nombre", 
    "codigoProyecto", 
    "estado", 
    "horasEstimadas", 
    "horasConsumidas",
    CASE 
        WHEN "horasConsumidas" > 0 THEN ROUND(("horasEstimadas"::numeric / "horasConsumidas"::numeric), 2)
        ELSE 0 
    END AS "tpi_eficiencia",
    ("horasEstimadas" - "horasConsumidas") AS "saldo_horas"
FROM "Project"
WHERE "horasEstimadas" > 0 AND "estado" != 'finalizado'
ORDER BY "tpi_eficiencia" DESC
LIMIT 50;`
    },
    {
        nombre: 'Horas y Fichadas del Mes',
        descripcion: 'Total de horas registradas por operarios durante el mes en curso.',
        sql: `SELECT 
    o."nombreCompleto" AS "operario",
    o."dni",
    COUNT(f."id") AS "total_fichadas",
    ROUND(SUM(COALESCE(f."horasNetas", 0))::numeric, 2) AS "total_horas"
FROM "Operator" o
LEFT JOIN "Fichada" f ON f."operatorId" = o."id" 
    AND f."timestamp" >= {{INICIO_MES}} 
    AND f."timestamp" <= {{FIN_MES}}
WHERE o."activo" = true
GROUP BY o."id", o."nombreCompleto", o."dni"
ORDER BY "total_horas" DESC;`
    },
    {
        nombre: 'Cotizaciones y Ventas Recientes',
        descripcion: 'Listado de cotizaciones comerciales con montos y estados.',
        sql: `SELECT 
    "numero",
    "clienteNombre",
    "estado",
    "total",
    "condicionPago",
    "createdAt" AS "fecha"
FROM "Cotizacion"
ORDER BY "createdAt" DESC
LIMIT 50;`
    },
    {
        nombre: 'Stock Crítico en Almacén',
        descripcion: 'Productos o materiales cuyo stock actual está por debajo del nivel mínimo.',
        sql: `SELECT 
    "sku",
    "nombre",
    "stockActual",
    "stockMinimo",
    ("stockMinimo" - "stockActual") AS "unidades_faltantes"
FROM "Producto"
WHERE "stockActual" <= "stockMinimo" AND "activo" = true
ORDER BY "unidades_faltantes" DESC
LIMIT 50;`
    },
    {
        nombre: 'Órdenes de Servicio Pendientes',
        descripcion: 'Órdenes de servicio activas o en proceso con proyecto asignado.',
        sql: `SELECT 
    os."numeroOS",
    os."titulo",
    os."estado",
    os."prioridad",
    p."nombre" AS "proyecto",
    os."fechaCompromiso"
FROM "OrdenServicio" os
LEFT JOIN "Project" p ON os."proyectoId" = p."id"
WHERE os."estado" NOT IN ('FINALIZADA', 'CANCELADA')
ORDER BY os."fechaCompromiso" ASC
LIMIT 50;`
    }
];

export default function DatasetFormModal({ dataset, operators, onClose, onSave }: any) {
    const [form, setForm] = useState({
        nombre: dataset?.nombre || '',
        descripcion: dataset?.descripcion || '',
        responsableId: dataset?.responsableId || '',
        estado: dataset?.estado || 'Activo',
        habilitado: dataset?.habilitado !== false,
        modoConsulta: dataset?.modoConsulta || 'SQL',
        consultaSQL: dataset?.consultaSQL || '',
        tipoEjecucion: dataset?.tipoEjecucion || 'Manual',
        frecuencia: dataset?.frecuencia || '',
        horaEjecucion: dataset?.horaEjecucion || '',
        timeoutSegundos: dataset?.timeoutSegundos || 30,
        limiteRegistros: dataset?.limiteRegistros || 10000,
        definicionVisual: dataset?.definicionVisual || { 
            tablas: [], 
            relaciones: [], 
            campos: [], 
            filtros: [], 
            agrupaciones: [], 
            ordenamiento: [] 
        },
    });
    
    const [saving, setSaving] = useState(false);
    const [tablas, setTablas] = useState<any[]>([]);
    const [loadingTablas, setLoadingTablas] = useState(true);
    const [schemaSearch, setSchemaSearch] = useState('');
    const [expandedTables, setExpandedTables] = useState<Record<string, boolean>>({});
    
    // Preview states
    const [previewData, setPreviewData] = useState<any[] | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewError, setPreviewError] = useState<string | null>(null);
    const [previewStats, setPreviewStats] = useState<{ durationMs?: number; count?: number } | null>(null);
    const [copiedPreviewMd, setCopiedPreviewMd] = useState(false);
    const [resultTab, setResultTab] = useState<'tabla' | 'perfil'>('tabla');
    const [resultFilter, setResultFilter] = useState('');
    const [mounted, setMounted] = useState(false);
    
    const editorRef = useRef<any>(null);

    const isFormValid = Boolean(
        form.nombre.trim() && 
        (form.modoConsulta === 'SQL' 
            ? form.consultaSQL.trim() 
            : (form.definicionVisual.campos && form.definicionVisual.campos.length > 0))
    );

    // Global keyboard shortcuts: Ctrl+Enter (test), Ctrl+S (save)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                handleTestSQL(false);
            } else if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
                e.preventDefault();
                if (isFormValid && !saving) {
                    onSave({ ...form, responsableId: form.responsableId || null });
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [form, isFormValid, saving]);

    useEffect(() => {
        setMounted(true);
        const fetchSchema = async () => {
            try {
                const res = await fetch('/api/diccionario-datos?incluirOcultas=false&incluirCampos=true');
                if (res.ok) {
                    const data = await res.json();
                    setTablas(data);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoadingTablas(false);
            }
        };
        fetchSchema();
    }, []);

    const toggleTable = (id: string) => {
        setExpandedTables(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const expandAllTables = () => {
        const next: Record<string, boolean> = {};
        tablas.forEach(t => { next[t.id] = true; });
        setExpandedTables(next);
    };

    const collapseAllTables = () => {
        setExpandedTables({});
    };

    const insertText = (text: string) => {
        const input = editorRef.current?._input;
        if (!input) {
            setForm(p => ({ ...p, consultaSQL: p.consultaSQL + text }));
            return;
        }
        const start = input.selectionStart;
        const end = input.selectionEnd;
        const val = form.consultaSQL;
        const newText = val.substring(0, start) + text + val.substring(end);
        setForm(p => ({ ...p, consultaSQL: newText }));
        
        setTimeout(() => {
            input.focus();
            input.setSelectionRange(start + text.length, start + text.length);
        }, 10);
    };

    // Smart schema table click handling
    const handleSchemaTableClick = (nombreTabla: string) => {
        if (form.modoConsulta === 'Visual') {
            const currentTablas = form.definicionVisual?.tablas || [];
            if (currentTablas.length === 0) {
                setForm(p => ({
                    ...p,
                    definicionVisual: {
                        ...p.definicionVisual,
                        tablas: [{ nombreTabla }]
                    }
                }));
                showToast(`Tabla principal "${nombreTabla}" seleccionada`, 'info');
            } else {
                insertText(`"${nombreTabla}"`);
            }
        } else {
            insertText(`"${nombreTabla}"`);
        }
    };

    // Smart schema field click handling
    const handleSchemaFieldClick = (nombreTabla: string, nombreCampo: string) => {
        if (form.modoConsulta === 'Visual') {
            const currentCampos = form.definicionVisual?.campos || [];
            const exists = currentCampos.some((c: any) => c.tabla === nombreTabla && c.nombreCampo === nombreCampo);
            let nextCampos: any[];
            if (exists) {
                nextCampos = currentCampos.filter((c: any) => !(c.tabla === nombreTabla && c.nombreCampo === nombreCampo));
                setForm(p => ({
                    ...p,
                    definicionVisual: {
                        ...p.definicionVisual,
                        campos: nextCampos
                    }
                }));
                showToast(`Campo "${nombreCampo}" removido`, 'info');
            } else {
                const currentTablas = form.definicionVisual?.tablas || [];
                const hasTable = currentTablas.some((t: any) => t.nombreTabla === nombreTabla);
                const nextTablas = hasTable ? currentTablas : [...currentTablas, { nombreTabla }];
                nextCampos = [...currentCampos, { tabla: nombreTabla, nombreCampo }];
                setForm(p => ({
                    ...p,
                    definicionVisual: {
                        ...p.definicionVisual,
                        tablas: nextTablas,
                        campos: nextCampos
                    }
                }));
                showToast(`Campo "${nombreTabla}.${nombreCampo}" agregado a la consulta`, 'success');
            }
        } else {
            insertText(`"${nombreTabla}"."${nombreCampo}"`);
        }
    };

    // Quick sample table view (5 rows)
    const handleQuickSampleTable = async (nombreTabla: string) => {
        setPreviewLoading(true);
        setPreviewError(null);
        setPreviewData(null);
        try {
            const res = await fetch('/api/datasets/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    sql: `SELECT * FROM "${nombreTabla}" LIMIT 5`, 
                    modoConsulta: 'SQL' 
                }),
            });
            const data = await res.json();
            if (res.ok) {
                setPreviewData(data.datos || []);
                setPreviewStats({ durationMs: data.duracionMs, count: data.cantidadRegistros });
                showToast(`Muestra de 5 filas de "${nombreTabla}" cargada`, 'success');
            } else {
                setPreviewError(data.error);
            }
        } catch (err: any) {
            setPreviewError(err.message || 'Error al obtener muestra');
        } finally {
            setPreviewLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        await onSave({ ...form, responsableId: form.responsableId || null });
        setSaving(false);
    };

    const handleTestSQL = async (silent = false) => {
        if (form.modoConsulta === 'SQL' && !form.consultaSQL.trim()) {
            if (!silent) showToast('La consulta SQL está vacía', 'error');
            return;
        }
        if (form.modoConsulta === 'Visual' && (!form.definicionVisual.campos || form.definicionVisual.campos.length === 0)) {
            return;
        }
        
        setPreviewLoading(true);
        setPreviewError(null);
        setPreviewData(null);
        
        try {
            const res = await fetch('/api/datasets/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    sql: form.consultaSQL, 
                    modoConsulta: form.modoConsulta, 
                    definicionVisual: form.definicionVisual 
                }),
            });
            const data = await res.json();
            
            if (res.ok) {
                setPreviewData(data.datos || []);
                setPreviewStats({ durationMs: data.duracionMs, count: data.cantidadRegistros });
                if (!silent) showToast(`Prueba exitosa: ${data.cantidadRegistros} registros en ${data.duracionMs}ms.`, 'success');
            } else {
                setPreviewError(data.error);
                if (!silent) showToast('Error en la prueba de SQL', 'error');
            }
        } catch (err: any) {
            setPreviewError(err.message || 'Error desconocido');
        } finally {
            setPreviewLoading(false);
        }
    };

    // Live preview effect for Visual Mode
    useEffect(() => {
        if (form.modoConsulta !== 'Visual') return;
        if (!form.definicionVisual.campos || form.definicionVisual.campos.length === 0) return;
        
        const timeoutId = setTimeout(() => {
            handleTestSQL(true);
        }, 900);
        
        return () => clearTimeout(timeoutId);
    }, [form.definicionVisual, form.modoConsulta]);

    // Mode switch handler: when switching from Visual to SQL, prompt/transfer SQL
    const handleSwitchToSQL = () => {
        if (form.modoConsulta === 'Visual') {
            try {
                if (form.definicionVisual.tablas?.length > 0 && form.definicionVisual.campos?.length > 0) {
                    const sql = construirSQLDesdeVisual(form.definicionVisual as DefinicionVisual);
                    if (sql && (!form.consultaSQL || form.consultaSQL.trim().length === 0)) {
                        setForm(p => ({ ...p, modoConsulta: 'SQL', consultaSQL: sql }));
                        showToast('SQL generado desde el constructor visual transferido al editor', 'info');
                        return;
                    }
                }
            } catch {}
        }
        setForm(p => ({ ...p, modoConsulta: 'SQL' }));
    };

    const handleApplyTemplate = (template: typeof TEMPLATES_HDB[0]) => {
        setForm(p => ({
            ...p,
            nombre: p.nombre || template.nombre,
            descripcion: p.descripcion || template.descripcion,
            modoConsulta: 'SQL',
            consultaSQL: template.sql
        }));
        showToast(`Plantilla "${template.nombre}" aplicada`, 'success');
    };

    const formatSQL = () => {
        if (!form.consultaSQL) return;
        // Basic SQL clean up: uppercase keywords and format line breaks
        const keywords = ['SELECT', 'FROM', 'LEFT JOIN', 'INNER JOIN', 'RIGHT JOIN', 'JOIN', 'WHERE', 'AND', 'OR', 'GROUP BY', 'ORDER BY', 'LIMIT', 'HAVING', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'AS', 'ON', 'DESC', 'ASC'];
        let formatted = form.consultaSQL;
        keywords.forEach(kw => {
            const regex = new RegExp(`\\b${kw}\\b`, 'gi');
            formatted = formatted.replace(regex, kw);
        });
        setForm(p => ({ ...p, consultaSQL: formatted }));
        showToast('Palabras clave SQL normalizadas', 'info');
    };

    const getPreviewColumns = () => {
        if (!previewData || previewData.length === 0) return [];
        return Object.keys(previewData[0]);
    };

    const downloadPreviewCSV = () => {
        if (!previewData || previewData.length === 0) return;
        const columns = getPreviewColumns();
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
        a.download = `${form.nombre.replace(/\s+/g, '_') || 'dataset'}_muestra.csv`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('CSV exportado con codificación compatible con Excel', 'success');
    };

    const copyPreviewJSON = () => {
        if (!previewData || previewData.length === 0) return;
        navigator.clipboard.writeText(JSON.stringify(previewData, null, 2));
        showToast('JSON copiado al portapapeles', 'success');
    };

    const copyPreviewMD = () => {
        if (!previewData || previewData.length === 0) return;
        const columns = getPreviewColumns();
        const header = `| ${columns.join(' | ')} |`;
        const separator = `| ${columns.map(() => '---').join(' | ')} |`;
        const rows = previewData.slice(0, 20).map(row => 
            `| ${columns.map(col => String(row[col] ?? '')).join(' | ')} |`
        );
        navigator.clipboard.writeText([header, separator, ...rows].join('\n'));
        setCopiedPreviewMd(true);
        setTimeout(() => setCopiedPreviewMd(false), 2000);
        showToast('Tabla Markdown copiada al portapapeles', 'success');
    };

    // Column profiling for data analyst inspection
    const previewProfiling = useMemo(() => {
        if (!previewData || previewData.length === 0) return [];
        const columns = Object.keys(previewData[0]);
        const totalRows = previewData.length;

        return columns.map(col => {
            let nullCount = 0;
            const values: any[] = [];
            let numValues: number[] = [];
            const distinctSet = new Set();

            for (const row of previewData) {
                const val = row[col];
                if (val === null || val === undefined || val === '') {
                    nullCount++;
                } else {
                    distinctSet.add(val);
                    values.push(val);
                    if (typeof val === 'number') numValues.push(val);
                    else if (typeof val === 'string' && !isNaN(Number(val)) && val.trim() !== '') numValues.push(Number(val));
                }
            }

            const nonNullCount = totalRows - nullCount;
            const completenessPct = Math.round((nonNullCount / totalRows) * 100);

            let tipo = 'string';
            if (numValues.length > 0 && numValues.length === values.length) tipo = 'number';
            else if (values.some(v => v instanceof Date || (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)))) tipo = 'date';
            else if (values.every(v => typeof v === 'boolean')) tipo = 'boolean';

            let min: any = null, max: any = null, avg: any = null, sum: any = null;
            if (tipo === 'number' && numValues.length > 0) {
                min = Math.min(...numValues);
                max = Math.max(...numValues);
                sum = numValues.reduce((a, b) => a + b, 0);
                avg = Number((sum / numValues.length).toFixed(2));
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
                sampleValues: Array.from(distinctSet).slice(0, 3).map(v => String(v)).join(', ')
            };
        });
    }, [previewData]);

    const filteredPreviewData = useMemo(() => {
        if (!previewData || !resultFilter.trim()) return previewData;
        const q = resultFilter.toLowerCase();
        const columns = Object.keys(previewData[0]);
        return previewData.filter(row => 
            columns.some(col => String(row[col] ?? '').toLowerCase().includes(q))
        );
    }, [previewData, resultFilter]);

    // Filter tables in schema sidebar
    const filteredTablas = useMemo(() => {
        if (!schemaSearch.trim()) return tablas;
        const query = schemaSearch.toLowerCase();
        return tablas.filter(t => 
            t.nombreTabla.toLowerCase().includes(query) ||
            (t.campos && t.campos.some((c: any) => c.nombreCampo.toLowerCase().includes(query)))
        );
    }, [tablas, schemaSearch]);

    if (!mounted) return null;

    const modalContent = (
        <div className="fixed inset-0 bg-slate-50 dark:bg-slate-950 z-[9999] flex flex-col animate-in fade-in duration-200">
            {/* Header */}
            <header className="h-14 bg-card text-card-foreground border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 shrink-0 shadow-sm z-10">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center shrink-0">
                        <Database className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <input 
                        value={form.nombre} 
                        onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
                        placeholder="Nombre del Dataset (ej: Reporte de Horas y Eficiencia)..." 
                        className="text-base sm:text-lg font-bold bg-transparent border-none outline-none text-slate-800 dark:text-slate-100 w-full max-w-md placeholder-slate-400 focus:ring-0"
                    />
                    {dataset?.codigoDataset && (
                        <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2.5 py-1 rounded-md uppercase tracking-wider hidden sm:inline-block">
                            {dataset.codigoDataset}
                        </span>
                    )}
                </div>
                
                <div className="flex items-center gap-2.5 shrink-0">
                    <button 
                        type="button" 
                        onClick={onClose} 
                        className="h-9 px-3.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={handleSubmit} 
                        disabled={saving || !isFormValid} 
                        title={!form.nombre ? 'Ingresá el nombre del dataset' : (!isFormValid ? 'Completá la consulta SQL o seleccioná campos en el modo visual' : 'Guardar dataset (Ctrl+S)')}
                        className="h-9 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        <Save className="w-4 h-4" /> 
                        <span>{saving ? 'Guardando...' : (dataset ? 'Actualizar' : 'Guardar Dataset')}</span>
                        <kbd className="hidden sm:inline-flex items-center text-[11px] bg-indigo-700/60 text-indigo-100 px-1.5 py-0.5 rounded border border-indigo-500/40 font-mono">
                            Ctrl+S
                        </kbd>
                    </button>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden">
                {/* Left Sidebar: Schema Browser */}
                <aside className="w-72 bg-card text-card-foreground border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0">
                    <div className="p-3 border-b border-slate-200 dark:border-slate-800 space-y-2 bg-slate-50/50 dark:bg-slate-900/30">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                                <Table2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" /> 
                                Esquema ({filteredTablas.length})
                            </h3>
                            <div className="flex gap-1">
                                <button 
                                    type="button" 
                                    onClick={expandAllTables} 
                                    className="text-[11px] text-slate-500 hover:text-indigo-600 px-1" 
                                    title="Expandir todas"
                                >
                                    +
                                </button>
                                <button 
                                    type="button" 
                                    onClick={collapseAllTables} 
                                    className="text-[11px] text-slate-500 hover:text-indigo-600 px-1" 
                                    title="Colapsar todas"
                                >
                                    -
                                </button>
                            </div>
                        </div>

                        {/* Search in schema */}
                        <div className="relative">
                            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input 
                                type="text" 
                                value={schemaSearch} 
                                onChange={e => setSchemaSearch(e.target.value)} 
                                placeholder="Buscar tabla o campo..." 
                                className="w-full h-7 pl-8 pr-2 bg-card text-xs border border-slate-200 dark:border-slate-700 rounded-md outline-none focus:border-indigo-500 text-slate-700 dark:text-slate-200"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                        {loadingTablas ? (
                            <div className="flex flex-col items-center justify-center py-8 text-xs text-slate-400 gap-2">
                                <div className="w-5 h-5 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                                <span>Cargando esquema...</span>
                            </div>
                        ) : filteredTablas.length === 0 ? (
                            <div className="text-xs text-slate-400 text-center py-6 italic">
                                No se encontraron tablas
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {filteredTablas.map(tabla => {
                                    const isExpanded = expandedTables[tabla.id] || Boolean(schemaSearch.trim());
                                    return (
                                        <div key={tabla.id} className="text-xs">
                                            <div 
                                                className="flex items-center gap-1.5 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer group select-none transition-colors"
                                                onClick={() => toggleTable(tabla.id)}
                                            >
                                                {isExpanded ? (
                                                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                ) : (
                                                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                )}
                                                <Table2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                                <span className="font-semibold text-slate-700 dark:text-slate-300 truncate" title={tabla.nombreTabla}>
                                                    {tabla.nombreTabla}
                                                </span>
                                                <span className="text-[11px] text-slate-400 font-mono ml-auto">
                                                    {tabla.campos?.length || 0}
                                                </span>
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button 
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); handleQuickSampleTable(tabla.nombreTabla); }}
                                                        className="text-[11px] font-bold text-slate-500 hover:text-indigo-600 bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded"
                                                        title="Ver primeras 5 filas"
                                                    >
                                                        <Eye className="w-3 h-3" />
                                                    </button>
                                                    <button 
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); handleSchemaTableClick(tabla.nombreTabla); }}
                                                        className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-1 py-0.5 rounded hover:bg-indigo-100"
                                                        title={form.modoConsulta === 'Visual' ? 'Usar en Modo Visual' : 'Insertar en SQL'}
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                            </div>

                                            {isExpanded && tabla.campos && (
                                                <div className="ml-4 pl-2 border-l border-slate-200 dark:border-slate-800 space-y-0.5 mt-0.5">
                                                    {tabla.campos.map((campo: any) => (
                                                        <div 
                                                            key={campo.id} 
                                                            className="flex items-center gap-1.5 p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded group cursor-pointer" 
                                                            onClick={() => handleSchemaFieldClick(tabla.nombreTabla, campo.nombreCampo)}
                                                            title={`Agregar ${tabla.nombreTabla}.${campo.nombreCampo} (${campo.tipoDato})`}
                                                        >
                                                            {campo.esClavePrimaria ? (
                                                                <Key className="w-3 h-3 text-amber-500 shrink-0" />
                                                            ) : campo.esClaveForanea ? (
                                                                <Link2 className="w-3 h-3 text-indigo-400 shrink-0" />
                                                            ) : (
                                                                <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0"></span>
                                                            )}
                                                            <span className="text-slate-600 dark:text-slate-400 truncate text-[11px]">
                                                                {campo.nombreCampo}
                                                            </span>
                                                            <span className="text-[11px] text-slate-400 ml-auto uppercase opacity-60 font-mono">
                                                                {campo.tipoDato}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </aside>

                {/* Center: Editor & Results */}
                <main className="flex-1 flex flex-col bg-slate-50 dark:bg-[#1e1e1e] relative min-w-0">
                    <div className="flex-1 flex flex-col p-4 overflow-hidden relative">
                        {/* Editor Header with Mode Toggle & Actions */}
                        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                            <div className="flex bg-slate-200 dark:bg-slate-800 p-1 rounded-xl">
                                <button
                                    type="button"
                                    onClick={() => setForm(p => ({ ...p, modoConsulta: 'Visual' }))}
                                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                        form.modoConsulta === 'Visual' 
                                            ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' 
                                            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                                    }`}
                                >
                                    Modo Visual
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSwitchToSQL}
                                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                        form.modoConsulta === 'SQL' 
                                            ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' 
                                            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                                    }`}
                                >
                                    SQL Crudo
                                </button>
                            </div>

                            <div className="flex items-center gap-2">
                                {form.modoConsulta === 'SQL' && (
                                    <button 
                                        type="button"
                                        onClick={formatSQL}
                                        className="h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 shadow-sm"
                                        title="Normalizar palabras clave SQL"
                                    >
                                        <Wand2 className="w-3.5 h-3.5 text-indigo-500" />
                                        <span>Formatear</span>
                                    </button>
                                )}

                                <button 
                                    type="button" 
                                    onClick={() => handleTestSQL(false)}
                                    disabled={previewLoading || (form.modoConsulta === 'SQL' ? !form.consultaSQL.trim() : (!form.definicionVisual.campos || form.definicionVisual.campos.length === 0))}
                                    className="h-8 px-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-2 transition-colors"
                                    title="Ejecutar consulta (Ctrl+Enter)"
                                >
                                    <Play className="w-3.5 h-3.5" /> 
                                    <span>{previewLoading ? 'Ejecutando...' : 'Probar Consulta'}</span>
                                    <kbd className="hidden sm:inline-flex items-center text-[11px] bg-emerald-700/60 text-emerald-100 px-1.5 py-0.5 rounded border border-emerald-500/40 font-mono">
                                        Ctrl+↵
                                    </kbd>
                                </button>
                            </div>
                        </div>
                        
                        {/* Builder / IDE Container */}
                        {form.modoConsulta === 'Visual' ? (
                            <div className="flex-1 bg-white dark:bg-[#1a1a1a] border border-slate-300 dark:border-slate-800 rounded-xl overflow-hidden flex flex-col shadow-inner">
                                <VisualBuilder 
                                    definicion={form.definicionVisual} 
                                    onChange={(v) => setForm(p => ({ ...p, definicionVisual: v }))} 
                                    tablas={tablas} 
                                />
                            </div>
                        ) : (
                            <div className="flex-1 border border-slate-300 dark:border-slate-800 rounded-xl overflow-hidden flex flex-col bg-[#1e1e1e] shadow-inner relative">
                                <div className="flex-1 overflow-auto custom-scrollbar relative">
                                    <Editor
                                        value={form.consultaSQL}
                                        onValueChange={code => setForm(p => ({ ...p, consultaSQL: code }))}
                                        highlight={code => Prism.highlight(code, Prism.languages.sql, 'sql')}
                                        padding={16}
                                        ref={editorRef}
                                        textareaClassName="focus:outline-none"
                                        className="font-mono text-sm min-h-full w-full text-slate-200"
                                        placeholder="Escribí tu consulta SQL aquí (ej: SELECT * FROM &quot;Project&quot; WHERE &quot;activo&quot; = true)..."
                                        style={{
                                            fontFamily: '"Fira Code", "JetBrains Mono", Consolas, monospace',
                                            fontSize: 13,
                                            lineHeight: 1.6,
                                        }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Results Panel */}
                    {(previewData !== null || previewError || previewLoading) && (
                        <div className="h-72 border-t border-slate-300 dark:border-slate-800 bg-card text-card-foreground flex flex-col shrink-0 animate-in slide-in-from-bottom-2 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] z-20">
                            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50">
                                <div className="flex items-center gap-3">
                                    <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                                        <Database className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                                        Resultados de Prueba
                                    </h3>
                                    {previewStats && (
                                        <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                                            <span className="bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                                                {previewStats.count} registros
                                            </span>
                                            {previewStats.durationMs !== undefined && (
                                                <span className="bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded-full font-mono">
                                                    {previewStats.durationMs} ms
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {previewData && previewData.length > 0 && (
                                        <div className="flex items-center bg-slate-200/70 dark:bg-slate-800 p-0.5 rounded-lg ml-1">
                                            <button
                                                type="button"
                                                onClick={() => setResultTab('tabla')}
                                                className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold transition-all ${
                                                    resultTab === 'tabla'
                                                        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                                                }`}
                                            >
                                                Tabla
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setResultTab('perfil')}
                                                className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1 ${
                                                    resultTab === 'perfil'
                                                        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                                                }`}
                                            >
                                                <BarChart2 className="w-3 h-3" />
                                                Perfil Analítico
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center gap-2">
                                    {previewData && previewData.length > 0 && resultTab === 'tabla' && (
                                        <div className="relative">
                                            <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input
                                                type="text"
                                                value={resultFilter}
                                                onChange={e => setResultFilter(e.target.value)}
                                                placeholder="Filtrar resultados..."
                                                className="h-7 w-36 sm:w-44 pl-6 pr-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-[11px] outline-none focus:border-indigo-500"
                                            />
                                        </div>
                                    )}
                                    {previewData && previewData.length > 0 && (
                                        <>
                                            <button 
                                                type="button"
                                                onClick={copyPreviewMD}
                                                className="h-7 px-2 rounded-md border border-slate-200 dark:border-slate-700 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1 transition-colors"
                                                title="Copiar las primeras 20 filas en Markdown"
                                            >
                                                {copiedPreviewMd ? <Check className="w-3 h-3 text-emerald-600" /> : <FileText className="w-3 h-3" />}
                                                <span>Markdown</span>
                                            </button>
                                            <button 
                                                type="button"
                                                onClick={copyPreviewJSON}
                                                className="h-7 px-2 rounded-md border border-slate-200 dark:border-slate-700 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1 transition-colors"
                                            >
                                                <Copy className="w-3 h-3" />
                                                <span>JSON</span>
                                            </button>
                                            <button 
                                                type="button"
                                                onClick={downloadPreviewCSV}
                                                className="h-7 px-2.5 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold hover:bg-indigo-100 flex items-center gap-1 transition-colors"
                                            >
                                                <Download className="w-3 h-3" />
                                                <span>CSV</span>
                                            </button>
                                        </>
                                    )}
                                    <button 
                                        type="button"
                                        onClick={() => { setPreviewData(null); setPreviewError(null); setPreviewStats(null); setResultFilter(''); }} 
                                        className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            
                            <div className="flex-1 overflow-auto bg-card text-card-foreground p-0 relative custom-scrollbar">
                                {previewLoading ? (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 bg-card/60 backdrop-blur-xs">
                                        <div className="w-7 h-7 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-2" />
                                        <span className="text-xs">Ejecutando consulta en PostgreSQL...</span>
                                    </div>
                                ) : previewError ? (
                                    <div className="p-6 h-full flex items-center justify-center">
                                        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl p-4 flex gap-3 text-rose-700 dark:text-rose-400 max-w-2xl w-full">
                                            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                                            <div className="min-w-0">
                                                <h4 className="font-bold mb-1 text-xs uppercase tracking-wide">Error en Consulta</h4>
                                                <p className="text-xs font-mono whitespace-pre-wrap break-all leading-relaxed">{previewError}</p>
                                            </div>
                                        </div>
                                    </div>
                                ) : previewData && previewData.length === 0 ? (
                                    <div className="p-6 h-full flex items-center justify-center text-slate-400 text-xs italic">
                                        La consulta se ejecutó con éxito pero no devolvió ningún registro.
                                    </div>
                                ) : resultTab === 'tabla' ? (
                                    <table className="w-full text-left text-xs whitespace-nowrap">
                                        <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0 shadow-xs z-10">
                                            <tr>
                                                <th className="px-3 py-2 font-bold text-slate-500 uppercase text-[11px] tracking-wider w-10 text-center border-b border-slate-200 dark:border-slate-700">#</th>
                                                {getPreviewColumns().map(col => {
                                                    const prof = previewProfiling.find(p => p.column === col);
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
                                            {filteredPreviewData?.map((row, idx) => (
                                                <tr key={idx} className="hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20">
                                                    <td className="px-3 py-1.5 text-[11px] text-slate-400 text-center border-r border-slate-100 dark:border-slate-800">{idx + 1}</td>
                                                    {getPreviewColumns().map(col => {
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
                                    <div className="p-4 space-y-4">
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                            <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40">
                                                <div className="text-[11px] font-bold text-slate-400 uppercase">Muestra</div>
                                                <div className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-0.5">{previewData?.length || 0} filas</div>
                                            </div>
                                            <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40">
                                                <div className="text-[11px] font-bold text-slate-400 uppercase">Columnas</div>
                                                <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">{getPreviewColumns().length}</div>
                                            </div>
                                            <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40">
                                                <div className="text-[11px] font-bold text-slate-400 uppercase">Numéricas</div>
                                                <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                                                    {previewProfiling.filter(p => p.tipo === 'number').length}
                                                </div>
                                            </div>
                                            <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40">
                                                <div className="text-[11px] font-bold text-slate-400 uppercase">Fechas</div>
                                                <div className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                                                    {previewProfiling.filter(p => p.tipo === 'date').length}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-xs">
                                            <table className="w-full text-left text-xs">
                                                <thead className="bg-slate-100 dark:bg-slate-800 text-[11px] uppercase font-bold text-slate-600 dark:text-slate-400">
                                                    <tr>
                                                        <th className="px-3 py-2">Columna</th>
                                                        <th className="px-2 py-2">Tipo</th>
                                                        <th className="px-3 py-2">Completitud (No Nulos)</th>
                                                        <th className="px-2 py-2">Únicos</th>
                                                        <th className="px-3 py-2">Métricas / Muestra</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                    {previewProfiling.map(p => (
                                                        <tr key={p.column} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                                                            <td className="px-3 py-2 font-bold text-slate-800 dark:text-slate-200 font-mono text-[11px]">
                                                                {p.column}
                                                            </td>
                                                            <td className="px-2 py-2">
                                                                <span className={`px-1.5 py-0.5 rounded text-[11px] font-bold uppercase font-mono ${
                                                                    p.tipo === 'number' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300' :
                                                                    p.tipo === 'date' ? 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300' :
                                                                    p.tipo === 'boolean' ? 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300' :
                                                                    'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                                                }`}>
                                                                    {p.tipo}
                                                                </span>
                                                            </td>
                                                            <td className="px-3 py-2">
                                                                <div className="space-y-1">
                                                                    <div className="flex justify-between text-[11px] text-slate-500">
                                                                        <span>{p.nonNullCount}/{p.totalRows} ({p.completenessPct}%)</span>
                                                                        {p.nullCount > 0 && <span className="text-rose-500 font-semibold">{p.nullCount} nulls</span>}
                                                                    </div>
                                                                    <div className="h-1 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                                                        <div 
                                                                            className={`h-full rounded-full ${p.completenessPct === 100 ? 'bg-emerald-500' : p.completenessPct > 70 ? 'bg-indigo-500' : 'bg-amber-500'}`}
                                                                            style={{ width: `${p.completenessPct}%` }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-2 py-2 font-semibold text-slate-700 dark:text-slate-300 text-[11px]">
                                                                {p.cardinality}
                                                            </td>
                                                            <td className="px-3 py-2 text-slate-600 dark:text-slate-400 text-[11px]">
                                                                {p.tipo === 'number' ? (
                                                                    <div className="grid grid-cols-2 gap-x-2 font-mono text-[11px]">
                                                                        <span>Mín: <strong>{p.min}</strong></span>
                                                                        <span>Máx: <strong>{p.max}</strong></span>
                                                                        <span>Prom: <strong>{p.avg}</strong></span>
                                                                        <span>Suma: <strong>{p.sum}</strong></span>
                                                                    </div>
                                                                ) : p.tipo === 'date' ? (
                                                                    <div className="font-mono text-[11px]">
                                                                        <span>{p.sampleValues}</span>
                                                                    </div>
                                                                ) : (
                                                                    <div className="text-[11px] truncate max-w-xs text-slate-500" title={p.sampleValues}>
                                                                        {p.sampleValues || 'Vacío'}
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
                    )}
                </main>

                {/* Right Sidebar: Quick Actions, Templates & Settings */}
                <aside className="w-80 bg-card text-card-foreground border-l border-slate-200 dark:border-slate-800 flex flex-col shrink-0 overflow-y-auto custom-scrollbar">
                    
                    {/* Settings Section */}
                    <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3.5">
                        <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                            Configuración
                        </h3>
                        
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 mb-1">Descripción</label>
                            <textarea 
                                value={form.descripcion} 
                                onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} 
                                rows={2} 
                                className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-card text-slate-800 dark:text-slate-200 outline-none resize-none focus:border-indigo-500" 
                                placeholder="Finalidad y métricas principales de este dataset..." 
                            />
                        </div>
                        
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 mb-1">Responsable</label>
                            <select 
                                value={form.responsableId} 
                                onChange={e => setForm(p => ({ ...p, responsableId: e.target.value }))} 
                                className="w-full h-8 px-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-card text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500"
                            >
                                <option value="">Sin responsable asignado</option>
                                {operators?.map((op: any) => (
                                    <option key={op.id} value={op.id}>{op.nombreCompleto}</option>
                                ))}
                            </select>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2.5">
                            <div>
                                <label className="block mb-1 text-[13px] font-medium text-slate-700 dark:text-slate-200">Límite Registros</label>
                                <input 
                                    type="number" 
                                    min="1" 
                                    value={form.limiteRegistros} 
                                    onChange={e => setForm(p => ({ ...p, limiteRegistros: parseInt(e.target.value) || 1000 }))} 
                                    className="w-full h-8 px-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-card text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500" 
                                />
                            </div>
                            <div>
                                <label className="block mb-1 text-[13px] font-medium text-slate-700 dark:text-slate-200">Timeout (seg)</label>
                                <input 
                                    type="number" 
                                    min="5" 
                                    value={form.timeoutSegundos} 
                                    onChange={e => setForm(p => ({ ...p, timeoutSegundos: parseInt(e.target.value) || 30 }))} 
                                    className="w-full h-8 px-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-card text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500" 
                                />
                            </div>
                        </div>

                        {dataset && (
                            <div className="flex items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={form.habilitado} 
                                        onChange={e => setForm(p => ({ ...p, habilitado: e.target.checked }))} 
                                        className="rounded text-indigo-600 focus:ring-indigo-500" 
                                    />
                                    Habilitado
                                </label>
                                <div className="flex-1">
                                    <select 
                                        value={form.estado} 
                                        onChange={e => setForm(p => ({ ...p, estado: e.target.value }))} 
                                        className="w-full h-7 px-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-background text-slate-800 dark:text-slate-200 outline-none"
                                    >
                                        <option value="Activo">Activo</option>
                                        <option value="Error">Error</option>
                                        <option value="Inactivo">Inactivo</option>
                                    </select>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    {/* Schedule Section */}
                    <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3 bg-slate-50/50 dark:bg-slate-900/30">
                        <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" /> 
                            Programación
                        </h3>
                        
                        <select 
                            value={form.tipoEjecucion} 
                            onChange={e => setForm(p => ({ ...p, tipoEjecucion: e.target.value }))} 
                            className="w-full h-8 px-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-card text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 font-medium"
                        >
                            <option value="Manual">Ejecución Manual (Bajo Demanda)</option>
                            <option value="Programada">Ejecución Automática (Cron)</option>
                        </select>
                        
                        {form.tipoEjecucion === 'Programada' && (
                            <div className="grid grid-cols-2 gap-2.5 pt-1">
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Frecuencia</label>
                                    <select 
                                        value={form.frecuencia} 
                                        onChange={e => setForm(p => ({ ...p, frecuencia: e.target.value }))} 
                                        className="w-full h-8 px-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-card text-slate-800 dark:text-slate-200 outline-none"
                                    >
                                        <option value="Cada hora">Cada hora</option>
                                        <option value="Diario">Diario</option>
                                        <option value="Semanal">Semanal</option>
                                        <option value="Mensual">Mensual</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Hora</label>
                                    <input 
                                        type="time" 
                                        value={form.horaEjecucion} 
                                        onChange={e => setForm(p => ({ ...p, horaEjecucion: e.target.value }))} 
                                        className="w-full h-8 px-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-card text-slate-800 dark:text-slate-200 outline-none" 
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Plantillas Rápidas (HDB Real-World Templates) */}
                    <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                        <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                            Plantillas HDB
                        </h3>
                        <p className="text-[11px] text-slate-400 mb-2">Iniciá rápidamente con consultas listas para producción:</p>
                        <div className="space-y-1.5">
                            {TEMPLATES_HDB.map(t => (
                                <button
                                    key={t.nombre}
                                    type="button"
                                    onClick={() => handleApplyTemplate(t)}
                                    className="w-full text-left p-2 rounded-lg bg-slate-50 hover:bg-indigo-50/70 dark:bg-slate-900/60 dark:hover:bg-indigo-950/40 border border-slate-200 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-800 transition-all group"
                                >
                                    <div className="text-xs font-bold text-slate-700 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                                        {t.nombre}
                                    </div>
                                    <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                                        {t.descripcion}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                    
                    {/* Variables del Sistema */}
                    <div className="p-4 flex-1">
                        <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                            Variables Dinámicas del Sistema
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                            {[
                                { varName: '{{FECHA_ACTUAL}}', desc: 'Fecha de hoy (YYYY-MM-DD)' },
                                { varName: '{{AYER}}', desc: 'Fecha de ayer' },
                                { varName: '{{INICIO_MES}}', desc: 'Primer día del mes actual' },
                                { varName: '{{FIN_MES}}', desc: 'Último día del mes actual' },
                                { varName: '{{HACE_7_DIAS}}', desc: 'Hace 7 días' },
                                { varName: '{{HACE_30_DIAS}}', desc: 'Hace 30 días' },
                                { varName: '{{INICIO_AÑO}}', desc: 'Primer día del año actual' },
                                { varName: '{{MES_ACTUAL}}', desc: 'Número del mes actual (1-12)' },
                                { varName: '{{AÑO_ACTUAL}}', desc: 'Año actual (ej: 2026)' },
                            ].map(item => (
                                <button 
                                    key={item.varName}
                                    type="button"
                                    onClick={() => insertText(item.varName)} 
                                    title={item.desc}
                                    className="px-2 py-1 bg-slate-100 hover:bg-indigo-100 dark:bg-slate-800 dark:hover:bg-indigo-950/60 rounded text-[11px] font-mono text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors"
                                >
                                    {item.varName}
                                </button>
                            ))}
                        </div>
                    </div>

                </aside>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}
