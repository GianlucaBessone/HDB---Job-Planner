'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Database, Play, AlertTriangle, List, Clock, Table2, ChevronRight, ChevronDown, CheckCircle2 } from 'lucide-react';
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-sql';
import 'prismjs/themes/prism-tomorrow.css'; // Dark theme for code
import { showToast } from '@/components/Toast';

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
    });
    
    const [saving, setSaving] = useState(false);
    const [tablas, setTablas] = useState<any[]>([]);
    const [loadingTablas, setLoadingTablas] = useState(true);
    const [expandedTables, setExpandedTables] = useState<Record<string, boolean>>({});
    
    // Preview states
    const [previewData, setPreviewData] = useState<any[] | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewError, setPreviewError] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);
    
    const editorRef = useRef<any>(null);

    useEffect(() => {
        setMounted(true);
        const fetchSchema = async () => {
            try {
                const res = await fetch('/api/diccionario-datos?incluirOcultas=false&incluirCampos=true');
                if (res.ok) {
                    setTablas(await res.json());
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

    const insertText = (text: string) => {
        const input = editorRef.current?._input;
        if (!input) {
            // Fallback if ref doesn't work
            setForm(p => ({ ...p, consultaSQL: p.consultaSQL + text }));
            return;
        }
        const start = input.selectionStart;
        const end = input.selectionEnd;
        const val = form.consultaSQL;
        const newText = val.substring(0, start) + text + val.substring(end);
        setForm(p => ({ ...p, consultaSQL: newText }));
        
        // Timeout to allow React to update the value before modifying selection
        setTimeout(() => {
            input.focus();
            input.setSelectionRange(start + text.length, start + text.length);
        }, 10);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        await onSave({ ...form, responsableId: form.responsableId || null });
        setSaving(false);
    };

    const handleTestSQL = async () => {
        if (!form.consultaSQL.trim()) {
            showToast('La consulta SQL está vacía', 'error');
            return;
        }
        
        setPreviewLoading(true);
        setPreviewError(null);
        setPreviewData(null);
        
        try {
            const res = await fetch('/api/datasets/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sql: form.consultaSQL }),
            });
            const data = await res.json();
            
            if (res.ok) {
                setPreviewData(data.datos || []);
                showToast(`Prueba exitosa: ${data.cantidadRegistros} registros en ${data.duracionMs}ms.`, 'success');
            } else {
                setPreviewError(data.error);
                showToast('Error en la prueba de SQL', 'error');
            }
        } catch (err: any) {
            setPreviewError(err.message || 'Error desconocido');
        } finally {
            setPreviewLoading(false);
        }
    };

    const getPreviewColumns = () => {
        if (!previewData || previewData.length === 0) return [];
        return Object.keys(previewData[0]);
    };

    if (!mounted) return null;

    const modalContent = (
        <div className="fixed inset-0 bg-slate-50 dark:bg-slate-950 z-[9999] flex flex-col animate-in fade-in duration-200">
            {/* Header */}
            <header className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 shrink-0 shadow-sm z-10">
                <div className="flex items-center gap-3 flex-1">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
                        <Database className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <input 
                        value={form.nombre} 
                        onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
                        placeholder="Nombre del Dataset..." 
                        className="text-lg font-bold bg-transparent border-none outline-none text-slate-800 dark:text-slate-100 w-full max-w-sm placeholder-slate-400 focus:ring-0"
                    />
                </div>
                
                <div className="flex items-center gap-3">
                    <button type="button" onClick={onClose} className="h-9 px-4 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        Cancelar
                    </button>
                    <button 
                        onClick={handleSubmit} 
                        disabled={saving || !form.nombre || !form.consultaSQL.trim()} 
                        className="h-9 px-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
                    >
                        <Save className="w-4 h-4" /> {saving ? 'Guardando...' : 'Guardar Dataset'}
                    </button>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden">
                {/* Left Sidebar: Schema Browser */}
                <aside className="w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0">
                    <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                            <Table2 className="w-4 h-4" /> Esquema de Datos
                        </h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2">
                        {loadingTablas ? (
                            <div className="text-xs text-slate-400 text-center py-4">Cargando esquema...</div>
                        ) : (
                            <div className="space-y-1">
                                {tablas.map(tabla => (
                                    <div key={tabla.id} className="text-sm">
                                        <div 
                                            className="flex items-center gap-1 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded cursor-pointer group"
                                            onClick={() => toggleTable(tabla.id)}
                                        >
                                            {expandedTables[tabla.id] ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
                                            <Table2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                            <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">{tabla.nombreTabla}</span>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); insertText(`"${tabla.nombreTabla}"`); }}
                                                className="ml-auto text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400 opacity-0 group-hover:opacity-100 px-1.5 py-0.5 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/50"
                                            >
                                                Add
                                            </button>
                                        </div>
                                        {expandedTables[tabla.id] && tabla.campos && (
                                            <div className="ml-5 pl-2 border-l border-slate-200 dark:border-slate-800 space-y-0.5 mt-0.5">
                                                {tabla.campos.map((campo: any) => (
                                                    <div key={campo.id} className="flex items-center gap-2 p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded group cursor-pointer" onClick={() => insertText(`"${tabla.nombreTabla}"."${campo.nombreCampo}"`)}>
                                                        <span className={`w-1.5 h-1.5 rounded-full ${campo.esClavePrimaria ? 'bg-amber-400' : campo.esClaveForanea ? 'bg-indigo-400' : 'bg-slate-300 dark:bg-slate-600'}`}></span>
                                                        <span className="text-xs text-slate-600 dark:text-slate-400 truncate">{campo.nombreCampo}</span>
                                                        <span className="text-[9px] text-slate-400 ml-auto uppercase opacity-60">{campo.tipoDato}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </aside>

                {/* Center: Editor & Results */}
                <main className="flex-1 flex flex-col bg-slate-50 dark:bg-[#1e1e1e] relative min-w-0">
                    <div className="flex-1 flex flex-col p-4 overflow-hidden relative">
                        {/* Editor Header */}
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                <CodeIcon /> Consulta SQL
                            </h3>
                            <button 
                                onClick={handleTestSQL}
                                disabled={previewLoading || !form.consultaSQL.trim()}
                                className="h-7 px-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                            >
                                <Play className="w-3 h-3" /> {previewLoading ? 'Ejecutando...' : 'Probar Consulta'}
                            </button>
                        </div>
                        
                        {/* IDE Editor Container */}
                        <div className="flex-1 border border-slate-300 dark:border-slate-700 rounded-lg overflow-hidden flex flex-col bg-[#1e1e1e] shadow-inner relative">
                            <div className="flex-1 overflow-auto custom-scrollbar relative">
                                <Editor
                                    value={form.consultaSQL}
                                    onValueChange={code => setForm(p => ({ ...p, consultaSQL: code }))}
                                    highlight={code => Prism.highlight(code, Prism.languages.sql, 'sql')}
                                    padding={16}
                                    ref={editorRef}
                                    textareaClassName="focus:outline-none"
                                    className="font-mono text-sm min-h-full w-full text-slate-200"
                                    style={{
                                        fontFamily: '"Fira Code", "JetBrains Mono", monospace',
                                        fontSize: 14,
                                        lineHeight: 1.5,
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Results Panel */}
                    {(previewData !== null || previewError || previewLoading) && (
                        <div className="h-64 border-t border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col shrink-0 animate-in slide-in-from-bottom-4 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] z-20">
                            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                                <h3 className="text-xs font-bold text-slate-600 dark:text-slate-300">Resultados de Prueba</h3>
                                <button onClick={() => { setPreviewData(null); setPreviewError(null); }} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded">
                                    <X className="w-4 h-4 text-slate-500" />
                                </button>
                            </div>
                            
                            <div className="flex-1 overflow-auto bg-white dark:bg-slate-900 p-0 relative">
                                {previewLoading ? (
                                    <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                                        <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-2" />
                                    </div>
                                ) : previewError ? (
                                    <div className="p-6 h-full flex items-center justify-center">
                                        <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/50 rounded-xl p-4 flex gap-3 text-rose-700 dark:text-rose-400 max-w-2xl w-full">
                                            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                                            <div>
                                                <h4 className="font-bold mb-1 text-sm">Error de Sintaxis o Ejecución</h4>
                                                <p className="text-xs font-mono whitespace-pre-wrap">{previewError}</p>
                                            </div>
                                        </div>
                                    </div>
                                ) : previewData && previewData.length === 0 ? (
                                    <div className="p-6 h-full flex items-center justify-center text-slate-500 text-sm italic">
                                        La consulta se ejecutó con éxito pero no devolvió ningún registro.
                                    </div>
                                ) : (
                                    <table className="w-full text-left text-sm whitespace-nowrap">
                                        <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0 shadow-sm z-10">
                                            <tr>
                                                <th className="px-4 py-2 font-bold text-slate-500 uppercase text-[10px] tracking-wider w-10 text-center border-b border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">#</th>
                                                {getPreviewColumns().map(col => (
                                                    <th key={col} className="px-4 py-2 font-bold text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">{col}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {previewData?.map((row, idx) => (
                                                <tr key={idx} className="hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10">
                                                    <td className="px-4 py-2 text-xs text-slate-400 text-center border-r border-slate-100 dark:border-slate-800">{idx + 1}</td>
                                                    {getPreviewColumns().map(col => {
                                                        const val = row[col];
                                                        const isDate = val instanceof Date || (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}T/));
                                                        return (
                                                            <td key={col} className="px-4 py-1.5 text-xs text-slate-700 dark:text-slate-300 font-mono">
                                                                {val === null ? <span className="text-slate-400 italic">null</span> :
                                                                 isDate ? new Date(val).toLocaleString() :
                                                                 typeof val === 'object' ? JSON.stringify(val) :
                                                                 String(val)}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    )}
                </main>

                {/* Right Sidebar: Quick Actions & Settings */}
                <aside className="w-80 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col shrink-0 overflow-y-auto">
                    
                    {/* Settings Section */}
                    <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-4">
                        <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-2">Configuración</h3>
                        
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Descripción</label>
                            <textarea value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} rows={2} className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded text-xs bg-transparent text-slate-800 dark:text-slate-200 outline-none resize-none focus:border-indigo-500" placeholder="Propósito de este dataset..." />
                        </div>
                        
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Responsable</label>
                            <select value={form.responsableId} onChange={e => setForm(p => ({ ...p, responsableId: e.target.value }))} className="w-full h-8 px-2 border border-slate-200 dark:border-slate-700 rounded text-xs bg-transparent text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500">
                                <option value="">Seleccionar...</option>
                                {operators?.map((op: any) => <option key={op.id} value={op.id}>{op.nombreCompleto}</option>)}
                            </select>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Límite Salida</label>
                                <input type="number" min="1" value={form.limiteRegistros} onChange={e => setForm(p => ({ ...p, limiteRegistros: parseInt(e.target.value) || 1000 }))} className="w-full h-8 px-2 border border-slate-200 dark:border-slate-700 rounded text-xs bg-transparent text-slate-800 dark:text-slate-200 outline-none" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Timeout (seg)</label>
                                <input type="number" min="5" value={form.timeoutSegundos} onChange={e => setForm(p => ({ ...p, timeoutSegundos: parseInt(e.target.value) || 30 }))} className="w-full h-8 px-2 border border-slate-200 dark:border-slate-700 rounded text-xs bg-transparent text-slate-800 dark:text-slate-200 outline-none" />
                            </div>
                        </div>

                        {dataset && (
                            <div className="flex items-center gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                                    <input type="checkbox" checked={form.habilitado} onChange={e => setForm(p => ({ ...p, habilitado: e.target.checked }))} className="rounded text-indigo-600" />
                                    Habilitado
                                </label>
                                <div className="flex-1">
                                    <select value={form.estado} onChange={e => setForm(p => ({ ...p, estado: e.target.value }))} className="w-full h-7 px-1 border border-slate-200 dark:border-slate-700 rounded text-xs bg-transparent text-slate-800 dark:text-slate-200 outline-none">
                                        <option value="Activo">Activo</option>
                                        <option value="Error">Error</option>
                                        <option value="Inactivo">Inactivo</option>
                                    </select>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    {/* Schedule Section */}
                    <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-4 bg-slate-50 dark:bg-slate-900/30">
                        <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5" /> Programación
                        </h3>
                        
                        <div>
                            <select value={form.tipoEjecucion} onChange={e => setForm(p => ({ ...p, tipoEjecucion: e.target.value }))} className="w-full h-8 px-2 border border-slate-200 dark:border-slate-700 rounded text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none">
                                <option value="Manual">Ejecución Manual</option>
                                <option value="Programada">Ejecución Automática</option>
                            </select>
                        </div>
                        
                        {form.tipoEjecucion === 'Programada' && (
                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Frecuencia</label>
                                    <select value={form.frecuencia} onChange={e => setForm(p => ({ ...p, frecuencia: e.target.value }))} className="w-full h-8 px-2 border border-slate-200 dark:border-slate-700 rounded text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none">
                                        <option value="Cada hora">Cada hora</option>
                                        <option value="Diario">Diario</option>
                                        <option value="Semanal">Semanal</option>
                                        <option value="Mensual">Mensual</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Hora</label>
                                    <input type="time" value={form.horaEjecucion} onChange={e => setForm(p => ({ ...p, horaEjecucion: e.target.value }))} className="w-full h-8 px-2 border border-slate-200 dark:border-slate-700 rounded text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none" />
                                </div>
                            </div>
                        )}
                    </div>
                    
                    {/* Snippets Section */}
                    <div className="p-4 flex-1">
                        <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-3">Acciones Rápidas</h3>
                        <div className="space-y-2">
                            <SnippetBtn label="SELECT Básico" sql="SELECT * FROM &quot;Tabla&quot;&#10;WHERE &quot;activo&quot; = true&#10;LIMIT 100" onClick={insertText} />
                            <SnippetBtn label="Contar Registros" sql="SELECT COUNT(&quot;id&quot;)::int as &quot;Cantidad&quot;&#10;FROM &quot;Tabla&quot;" onClick={insertText} />
                            <SnippetBtn label="Agrupar y Sumar" sql="SELECT &quot;categoria&quot;, SUM(&quot;monto&quot;) as &quot;Total&quot;&#10;FROM &quot;Tabla&quot;&#10;GROUP BY &quot;categoria&quot;" onClick={insertText} />
                            <SnippetBtn label="JOIN con Tablas" sql="SELECT a.*, b.&quot;nombre&quot;&#10;FROM &quot;TablaA&quot; a&#10;INNER JOIN &quot;TablaB&quot; b ON a.&quot;fkId&quot; = b.&quot;id&quot;" onClick={insertText} />
                            
                            <div className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-800">
                                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Variables del Sistema</h4>
                                <div className="flex flex-wrap gap-2">
                                    <button onClick={() => insertText("{{FECHA_ACTUAL}}")} className="px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded text-[10px] font-mono text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 transition-colors">{"{{FECHA_ACTUAL}}"}</button>
                                    <button onClick={() => insertText("{{INICIO_MES}}")} className="px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded text-[10px] font-mono text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 transition-colors">{"{{INICIO_MES}}"}</button>
                                    <button onClick={() => insertText("{{FIN_MES}}")} className="px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded text-[10px] font-mono text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 transition-colors">{"{{FIN_MES}}"}</button>
                                    <button onClick={() => insertText("{{AÑO_ACTUAL}}")} className="px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded text-[10px] font-mono text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 transition-colors">{"{{AÑO_ACTUAL}}"}</button>
                                </div>
                            </div>
                        </div>
                    </div>

                </aside>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}

function SnippetBtn({ label, sql, onClick }: { label: string, sql: string, onClick: (t: string) => void }) {
    return (
        <button 
            type="button"
            onClick={() => onClick(sql + '\n')} 
            className="w-full text-left px-3 py-2 bg-slate-50 dark:bg-slate-800/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 border border-slate-200 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-800 rounded-lg transition-all group"
        >
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">{label}</div>
        </button>
    );
}

function CodeIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
    )
}
