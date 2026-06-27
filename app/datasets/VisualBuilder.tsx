'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Plus, X, Filter, Table2, Type, Hash, Calendar } from 'lucide-react';

export default function VisualBuilder({ definicion, onChange, tablas }: { definicion: any, onChange: (d: any) => void, tablas: any[] }) {
    
    // Ensure default structure
    const def = definicion || { tablas: [], relaciones: [], campos: [], filtros: [], agrupaciones: [], ordenamiento: [] };
    
    // Simple Mode: Single table for now to avoid complex JOIN UI in MVP
    const mainTable = def.tablas[0]?.nombreTabla || '';
    
    // Use all selected tables to get available fields
    const tablasDisponibles = useMemo(() => {
        const nombres = def.tablas.map((t: any) => t.nombreTabla);
        return tablas.filter(t => nombres.includes(t.nombreTabla));
    }, [tablas, def.tablas]);

    const setMainTable = (nombre: string) => {
        onChange({ ...def, tablas: [{ nombreTabla: nombre }], relaciones: [], campos: [], filtros: [] });
    };

    const addRelacion = () => {
        onChange({
            ...def,
            relaciones: [...(def.relaciones || []), { tablaOrigen: mainTable, campoOrigen: '', tablaDestino: '', campoDestino: '', tipoJoin: 'INNER JOIN' }]
        });
    };

    const updateRelacion = (index: number, key: string, val: string) => {
        const newRelaciones = [...(def.relaciones || [])];
        newRelaciones[index][key] = val;
        
        // Auto-add the table to def.tablas if not present
        if (key === 'tablaDestino') {
            const exists = def.tablas.find((t: any) => t.nombreTabla === val);
            if (!exists && val) {
                const newTablas = [...def.tablas, { nombreTabla: val }];
                onChange({ ...def, tablas: newTablas, relaciones: newRelaciones });
                return;
            }
        }
        onChange({ ...def, relaciones: newRelaciones });
    };

    const removeRelacion = (index: number) => {
        const newRelaciones = [...(def.relaciones || [])];
        const removed = newRelaciones.splice(index, 1)[0];
        // Remove table from def.tablas if no longer joined (simple logic)
        const stillUsed = newRelaciones.some(r => r.tablaDestino === removed.tablaDestino || r.tablaOrigen === removed.tablaDestino) || mainTable === removed.tablaDestino;
        let newTablas = def.tablas;
        if (!stillUsed) {
            newTablas = def.tablas.filter((t: any) => t.nombreTabla !== removed.tablaDestino);
            // Also remove fields from that table
            const newCampos = def.campos.filter((c: any) => c.tabla !== removed.tablaDestino);
            onChange({ ...def, tablas: newTablas, relaciones: newRelaciones, campos: newCampos });
            return;
        }
        onChange({ ...def, relaciones: newRelaciones });
    };

    const toggleCampo = (tabla: string, campo: string) => {
        const existe = def.campos.find((c: any) => c.nombreCampo === campo && c.tabla === tabla);
        if (existe) {
            onChange({ ...def, campos: def.campos.filter((c: any) => !(c.nombreCampo === campo && c.tabla === tabla)) });
        } else {
            onChange({ ...def, campos: [...def.campos, { tabla, nombreCampo: campo }] });
        }
    };

    const updateCampoFuncion = (tabla: string, campo: string, funcion: string) => {
        const newCampos = def.campos.map((c: any) => {
            if (c.tabla === tabla && c.nombreCampo === campo) {
                return { ...c, funcion: funcion || null };
            }
            return c;
        });
        onChange({ ...def, campos: newCampos });
    };
    
    const addFiltro = () => {
        onChange({ 
            ...def, 
            filtros: [...(def.filtros || []), { campo: '', operador: 'EQUAL', valor: '', conector: 'AND' }] 
        });
    };

    const updateFiltro = (index: number, key: string, val: string) => {
        const newFiltros = [...(def.filtros || [])];
        newFiltros[index][key] = val;
        onChange({ ...def, filtros: newFiltros });
    };

    const removeFiltro = (index: number) => {
        const newFiltros = [...(def.filtros || [])];
        newFiltros.splice(index, 1);
        onChange({ ...def, filtros: newFiltros });
    };

    return (
        <div className="flex-1 p-6 overflow-auto custom-scrollbar flex flex-col gap-8 max-w-4xl mx-auto w-full">
            
            {/* 1. Selección de Tabla Principal */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-4">
                    <Table2 className="w-5 h-5 text-indigo-500" />
                    1. Tabla Principal
                </h3>
                <select 
                    value={mainTable} 
                    onChange={e => setMainTable(e.target.value)}
                    className="w-full max-w-md h-10 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium outline-none focus:border-indigo-500"
                >
                    <option value="">-- Seleccionar Tabla --</option>
                    {tablas.map(t => (
                        <option key={t.id} value={t.nombreTabla}>{t.nombreTabla}</option>
                    ))}
                </select>
                <p className="text-xs text-slate-400 mt-2">Selecciona la tabla principal para comenzar. Luego podrás unir otras tablas.</p>
            </div>

            {mainTable && (
                <>
                {/* 1.5. Relaciones (JOINs) */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            <Filter className="w-5 h-5 text-amber-500" />
                            Cruces de Datos (JOINs)
                        </h3>
                        <button onClick={addRelacion} className="h-8 px-3 bg-amber-50 text-amber-600 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 rounded-lg text-xs font-bold flex items-center gap-1">
                            <Plus className="w-3.5 h-3.5" /> Unir Tabla
                        </button>
                    </div>

                    {(!def.relaciones || def.relaciones.length === 0) ? (
                        <div className="py-4 text-center text-slate-400 text-sm bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                            Consultando de una única tabla.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {def.relaciones.map((rel: any, idx: number) => (
                                <div key={idx} className="flex flex-wrap items-center gap-2 bg-slate-50 dark:bg-slate-900/50 p-2 pl-4 rounded-xl border border-slate-200 dark:border-slate-700">
                                    <select value={rel.tipoJoin || 'INNER JOIN'} onChange={e => updateRelacion(idx, 'tipoJoin', e.target.value)} className="h-8 px-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs outline-none font-bold text-indigo-600">
                                        <option value="INNER JOIN">INNER JOIN</option>
                                        <option value="LEFT JOIN">LEFT JOIN</option>
                                        <option value="RIGHT JOIN">RIGHT JOIN</option>
                                    </select>

                                    <select value={rel.tablaDestino || ''} onChange={e => updateRelacion(idx, 'tablaDestino', e.target.value)} className="h-8 px-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs outline-none font-bold">
                                        <option value="">- Tabla Destino -</option>
                                        {tablas.filter(t => t.nombreTabla !== mainTable).map(t => (
                                            <option key={t.id} value={t.nombreTabla}>{t.nombreTabla}</option>
                                        ))}
                                    </select>
                                    <span className="text-xs font-black text-slate-400">ON</span>
                                    
                                    <select value={rel.tablaOrigen || ''} onChange={e => updateRelacion(idx, 'tablaOrigen', e.target.value)} className="h-8 px-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs outline-none max-w-[120px]">
                                        {def.tablas.map((t: any) => <option key={t.nombreTabla} value={t.nombreTabla}>{t.nombreTabla}</option>)}
                                    </select>
                                    <span className="text-xs text-slate-400">.</span>
                                    <select value={rel.campoOrigen || ''} onChange={e => updateRelacion(idx, 'campoOrigen', e.target.value)} className="h-8 px-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs outline-none max-w-[120px]">
                                        <option value="">- Campo -</option>
                                        {tablas.find(t => t.nombreTabla === rel.tablaOrigen)?.campos?.map((c: any) => (
                                            <option key={c.id} value={c.nombreCampo}>{c.nombreCampo}</option>
                                        ))}
                                    </select>

                                    <span className="text-xs font-black text-slate-400">=</span>

                                    <span className="text-xs font-bold px-2">{rel.tablaDestino || '?'}</span>
                                    <span className="text-xs text-slate-400">.</span>
                                    <select value={rel.campoDestino || ''} onChange={e => updateRelacion(idx, 'campoDestino', e.target.value)} className="h-8 px-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs outline-none max-w-[120px]">
                                        <option value="">- Campo -</option>
                                        {tablas.find(t => t.nombreTabla === rel.tablaDestino)?.campos?.map((c: any) => (
                                            <option key={c.id} value={c.nombreCampo}>{c.nombreCampo}</option>
                                        ))}
                                    </select>

                                    <button onClick={() => removeRelacion(idx)} className="ml-auto p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                {/* 2. Selección de Campos */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-4">
                        <Type className="w-5 h-5 text-indigo-500" />
                        Columnas a Mostrar
                    </h3>
                    
                    {tablasDisponibles.map(tablaInfo => (
                        <div key={tablaInfo.id} className="mb-6 last:mb-0">
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3 px-1">{tablaInfo.nombreTabla}</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                {tablaInfo.campos?.map((c: any) => {
                                    const campoSeleccionado = def.campos.find((x: any) => x.nombreCampo === c.nombreCampo && x.tabla === tablaInfo.nombreTabla);
                                    const isSelected = !!campoSeleccionado;
                                    return (
                                        <div 
                                            key={c.id} 
                                            className={`flex flex-col gap-2 p-3 rounded-xl border transition-all ${isSelected ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/30 dark:border-indigo-800 ring-1 ring-indigo-500' : 'bg-slate-50 border-slate-200 dark:bg-slate-900/50 dark:border-slate-700 hover:bg-slate-100'}`}
                                        >
                                            <label className="flex items-start gap-2 cursor-pointer min-w-0">
                                                <input 
                                                    type="checkbox" 
                                                    checked={isSelected}
                                                    onChange={() => toggleCampo(tablaInfo.nombreTabla, c.nombreCampo)}
                                                    className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <div className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate" title={c.nombreCampo}>{c.nombreCampo}</div>
                                                    <div className="text-[10px] text-slate-400 uppercase">{c.tipoDato}</div>
                                                </div>
                                            </label>
                                            
                                            {isSelected && (
                                                <div className="pl-6 pt-1 border-t border-indigo-100 dark:border-indigo-800/50 mt-1">
                                                    <select 
                                                        value={campoSeleccionado.funcion || ''}
                                                        onChange={(e) => updateCampoFuncion(tablaInfo.nombreTabla, c.nombreCampo, e.target.value)}
                                                        className="h-6 w-full px-1 text-[10px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded outline-none text-slate-600 dark:text-slate-300"
                                                    >
                                                        <option value="">(Sin función)</option>
                                                        <option value="COUNT">Contar (COUNT)</option>
                                                        <option value="SUM">Sumar (SUM)</option>
                                                        <option value="AVG">Promedio (AVG)</option>
                                                        <option value="MIN">Mínimo (MIN)</option>
                                                        <option value="MAX">Máximo (MAX)</option>
                                                        <option value="DISTINCT">Valores Únicos (DISTINCT)</option>
                                                    </select>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                {/* 3. Filtros */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            <Filter className="w-5 h-5 text-indigo-500" />
                            3. Filtros (Condiciones)
                        </h3>
                        <button onClick={addFiltro} className="h-8 px-3 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 rounded-lg text-xs font-bold flex items-center gap-1">
                            <Plus className="w-3.5 h-3.5" /> Agregar Filtro
                        </button>
                    </div>
                    
                    {(!def.filtros || def.filtros.length === 0) ? (
                        <div className="py-6 text-center text-slate-400 text-sm italic bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                            No hay filtros aplicados. Se traerán todos los registros.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {def.filtros.map((f: any, idx: number) => (
                                <div key={idx} className="flex flex-wrap items-center gap-2 bg-slate-50 dark:bg-slate-900/50 p-2 pl-4 rounded-xl border border-slate-200 dark:border-slate-700">
                                    {idx > 0 && (
                                        <select 
                                            value={f.conector || 'AND'} 
                                            onChange={e => updateFiltro(idx, 'conector', e.target.value)}
                                            className="h-8 px-2 bg-transparent text-xs font-black text-indigo-600 outline-none"
                                        >
                                            <option value="AND">Y (AND)</option>
                                            <option value="OR">O (OR)</option>
                                        </select>
                                    )}
                                    {idx === 0 && <span className="text-xs font-black text-indigo-600 w-16">DONDE</span>}

                                    <select 
                                        value={f.campo || ''} 
                                        onChange={e => updateFiltro(idx, 'campo', e.target.value)}
                                        className="h-8 px-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs outline-none"
                                    >
                                        <option value="">- Campo -</option>
                                        {tablasDisponibles.flatMap(t => t.campos?.map((c: any) => (
                                            <option key={`${t.nombreTabla}.${c.nombreCampo}`} value={`${t.nombreTabla}.${c.nombreCampo}`}>
                                                {t.nombreTabla}.{c.nombreCampo}
                                            </option>
                                        )))}
                                    </select>

                                    <select 
                                        value={f.operador || 'EQUAL'} 
                                        onChange={e => updateFiltro(idx, 'operador', e.target.value)}
                                        className="h-8 px-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs outline-none"
                                    >
                                        <option value="EQUAL">Igual a (=)</option>
                                        <option value="NOT_EQUAL">Distinto a (!=)</option>
                                        <option value="GREATER">Mayor a (&gt;)</option>
                                        <option value="LESS">Menor a (&lt;)</option>
                                        <option value="GREATER_EQUAL">Mayor o igual (&gt;=)</option>
                                        <option value="LESS_EQUAL">Menor o igual (&lt;=)</option>
                                        <option value="LIKE">Contiene (LIKE)</option>
                                        <option value="IS_NULL">Es Nulo</option>
                                        <option value="IS_NOT_NULL">No es Nulo</option>
                                    </select>

                                    {f.operador !== 'IS_NULL' && f.operador !== 'IS_NOT_NULL' && (
                                        <input 
                                            type="text" 
                                            value={f.valor || ''} 
                                            onChange={e => updateFiltro(idx, 'valor', e.target.value)}
                                            placeholder="Valor..."
                                            className="h-8 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs outline-none flex-1 min-w-[100px]"
                                        />
                                    )}

                                    <button onClick={() => removeFiltro(idx)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                </>
            )}
        </div>
    );
}
