'use client';

import React, { useState, useMemo } from 'react';
import { Plus, X, Filter, Table2, Type, ArrowUpDown, Search, CheckSquare, Square, Eye, Sparkles } from 'lucide-react';
import { construirSQLDesdeVisual, DefinicionVisual } from '@/lib/datasetEngine';

export default function VisualBuilder({ 
    definicion, 
    onChange, 
    tablas 
}: { 
    definicion: any; 
    onChange: (d: any) => void; 
    tablas: any[];
}) {
    // Ensure default structure
    const def = definicion || { 
        tablas: [], 
        relaciones: [], 
        campos: [], 
        filtros: [], 
        agrupaciones: [], 
        ordenamiento: [] 
    };

    const [fieldSearch, setFieldSearch] = useState<Record<string, string>>({});
    const [showGeneratedSQL, setShowGeneratedSQL] = useState(false);

    const mainTable = def.tablas[0]?.nombreTabla || '';

    // Use all selected tables to get available fields
    const tablasDisponibles = useMemo(() => {
        const nombres = (def.tablas || []).map((t: any) => t.nombreTabla);
        return tablas.filter(t => nombres.includes(t.nombreTabla));
    }, [tablas, def.tablas]);

    // Available fields flattened for dropdowns (filters, order by)
    const todosLosCampos = useMemo(() => {
        return tablasDisponibles.flatMap(t => 
            (t.campos || []).map((c: any) => ({
                id: `${t.nombreTabla}.${c.nombreCampo}`,
                tabla: t.nombreTabla,
                campo: c.nombreCampo,
                tipo: c.tipoDato || 'string',
                label: `${t.nombreTabla}.${c.nombreCampo}`
            }))
        );
    }, [tablasDisponibles]);

    const setMainTable = (nombre: string) => {
        onChange({ 
            ...def, 
            tablas: [{ nombreTabla: nombre }], 
            relaciones: [], 
            campos: [], 
            filtros: [], 
            ordenamiento: [] 
        });
    };

    // ── Relaciones (JOINs) ──────────────────────────────────────────────────
    const addRelacion = () => {
        onChange({
            ...def,
            relaciones: [
                ...(def.relaciones || []), 
                { tablaOrigen: mainTable, campoOrigen: '', tablaDestino: '', campoDestino: '', tipoJoin: 'INNER JOIN' }
            ]
        });
    };

    const syncTablasWithRelaciones = (relaciones: any[]) => {
        const setOfTables = new Set<string>();
        if (mainTable) setOfTables.add(mainTable);
        for (const r of relaciones) {
            if (r.tablaDestino) setOfTables.add(r.tablaDestino);
        }
        return Array.from(setOfTables).map(nombreTabla => ({ nombreTabla }));
    };

    const updateRelacion = (index: number, key: string, val: string) => {
        const newRelaciones = [...(def.relaciones || [])];
        newRelaciones[index][key] = val;
        const newTablas = syncTablasWithRelaciones(newRelaciones);
        onChange({ ...def, tablas: newTablas, relaciones: newRelaciones });
    };

    const removeRelacion = (index: number) => {
        const newRelaciones = [...(def.relaciones || [])];
        newRelaciones.splice(index, 1);
        const newTablas = syncTablasWithRelaciones(newRelaciones);
        const activeTableNames = newTablas.map(t => t.nombreTabla);
        const newCampos = (def.campos || []).filter((c: any) => activeTableNames.includes(c.tabla));
        onChange({ ...def, tablas: newTablas, relaciones: newRelaciones, campos: newCampos });
    };

    // ── Campos ─────────────────────────────────────────────────────────────
    const toggleCampo = (tabla: string, campo: string) => {
        const existe = (def.campos || []).find((c: any) => c.nombreCampo === campo && c.tabla === tabla);
        if (existe) {
            onChange({ ...def, campos: def.campos.filter((c: any) => !(c.nombreCampo === campo && c.tabla === tabla)) });
        } else {
            onChange({ ...def, campos: [...(def.campos || []), { tabla, nombreCampo: campo }] });
        }
    };

    const selectAllCampos = (tabla: string) => {
        const tablaInfo = tablas.find(t => t.nombreTabla === tabla);
        if (!tablaInfo?.campos) return;
        const currentOtherCampos = (def.campos || []).filter((c: any) => c.tabla !== tabla);
        const newCamposForTable = tablaInfo.campos.map((c: any) => ({
            tabla,
            nombreCampo: c.nombreCampo
        }));
        onChange({ ...def, campos: [...currentOtherCampos, ...newCamposForTable] });
    };

    const deselectAllCampos = (tabla: string) => {
        onChange({ ...def, campos: (def.campos || []).filter((c: any) => c.tabla !== tabla) });
    };

    const updateCampoFuncion = (tabla: string, campo: string, funcion: string) => {
        const newCampos = (def.campos || []).map((c: any) => {
            if (c.tabla === tabla && c.nombreCampo === campo) {
                return { ...c, funcion: funcion || null };
            }
            return c;
        });
        onChange({ ...def, campos: newCampos });
    };

    const updateCampoAlias = (tabla: string, campo: string, alias: string) => {
        const newCampos = (def.campos || []).map((c: any) => {
            if (c.tabla === tabla && c.nombreCampo === campo) {
                return { ...c, alias: alias.trim() || undefined };
            }
            return c;
        });
        onChange({ ...def, campos: newCampos });
    };

    // ── Filtros ────────────────────────────────────────────────────────────
    const addFiltro = () => {
        const primerCampo = todosLosCampos[0]?.id || '';
        onChange({ 
            ...def, 
            filtros: [...(def.filtros || []), { campo: primerCampo, operador: 'EQUAL', valor: '', conector: 'AND' }] 
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

    // ── Ordenamiento ───────────────────────────────────────────────────────
    const addOrden = () => {
        const primerCampo = todosLosCampos[0]?.id || '';
        onChange({
            ...def,
            ordenamiento: [...(def.ordenamiento || []), { campo: primerCampo, direccion: 'DESC' }]
        });
    };

    const updateOrden = (index: number, key: string, val: string) => {
        const newOrden = [...(def.ordenamiento || [])];
        newOrden[index][key] = val;
        onChange({ ...def, ordenamiento: newOrden });
    };

    const removeOrden = (index: number) => {
        const newOrden = [...(def.ordenamiento || [])];
        newOrden.splice(index, 1);
        onChange({ ...def, ordenamiento: newOrden });
    };

    // Generated SQL preview for visual mode
    const generatedSQL = useMemo(() => {
        try {
            if (def.tablas?.length > 0 && def.campos?.length > 0) {
                return construirSQLDesdeVisual(def as DefinicionVisual);
            }
        } catch {
            return '';
        }
        return '';
    }, [def]);

    return (
        <div className="flex-1 p-6 overflow-auto custom-scrollbar flex flex-col gap-6 max-w-5xl mx-auto w-full">
            
            {/* 1. Selección de Tabla Principal */}
            <div className="bg-card text-card-foreground p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <Table2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        1. Tabla Principal
                    </h3>
                    {mainTable && (
                        <span className="text-xs bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 font-semibold px-2.5 py-0.5 rounded-full">
                            {mainTable}
                        </span>
                    )}
                </div>
                <select 
                    value={mainTable} 
                    onChange={e => setMainTable(e.target.value)}
                    className="w-full max-w-md h-10 px-3 bg-background text-foreground border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                >
                    <option value="">-- Seleccionar Tabla Base --</option>
                    {tablas.map(t => (
                        <option key={t.id} value={t.nombreTabla}>{t.nombreTabla}</option>
                    ))}
                </select>
                <p className="text-xs text-slate-400 mt-2">
                    Seleccioná la entidad principal para comenzar. Después podés vincular otras tablas mediante JOINs.
                </p>
            </div>

            {mainTable && (
                <>
                {/* 2. Cruces de Datos (JOINs) */}
                <div className="bg-card text-card-foreground p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                <Filter className="w-4 h-4 text-amber-500" />
                                2. Relaciones y Cruces (JOINs)
                            </h3>
                            <p className="text-xs text-slate-400 mt-0.5">Uní tablas secundarias para enriquecer tu dataset.</p>
                        </div>
                        <button 
                            type="button"
                            onClick={addRelacion} 
                            className="h-8 px-3 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 dark:hover:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                        >
                            <Plus className="w-3.5 h-3.5" /> Agregar JOIN
                        </button>
                    </div>

                    {(!def.relaciones || def.relaciones.length === 0) ? (
                        <div className="py-4 text-center text-slate-400 text-xs bg-slate-50/50 dark:bg-slate-900/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                            Solo se está consultando la tabla principal <strong className="text-slate-600 dark:text-slate-300 font-mono">"{mainTable}"</strong>. Clic en "Agregar JOIN" para combinarla con otra tabla.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {def.relaciones.map((rel: any, idx: number) => (
                                <div key={idx} className="flex flex-wrap items-center gap-2 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                                    <select 
                                        value={rel.tipoJoin || 'INNER JOIN'} 
                                        onChange={e => updateRelacion(idx, 'tipoJoin', e.target.value)} 
                                        className="h-8 px-2 bg-card text-card-foreground border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none font-bold text-indigo-600"
                                    >
                                        <option value="INNER JOIN">INNER JOIN</option>
                                        <option value="LEFT JOIN">LEFT JOIN</option>
                                        <option value="RIGHT JOIN">RIGHT JOIN</option>
                                    </select>

                                    <select 
                                        value={rel.tablaDestino || ''} 
                                        onChange={e => updateRelacion(idx, 'tablaDestino', e.target.value)} 
                                        className="h-8 px-2 bg-card text-card-foreground border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none font-semibold text-slate-700 dark:text-slate-200"
                                    >
                                        <option value="">- Tabla Destino -</option>
                                        {tablas.filter(t => t.nombreTabla !== mainTable).map(t => (
                                            <option key={t.id} value={t.nombreTabla}>{t.nombreTabla}</option>
                                        ))}
                                    </select>
                                    <span className="text-xs font-bold text-slate-400">ON</span>
                                    
                                    <select 
                                        value={rel.tablaOrigen || ''} 
                                        onChange={e => updateRelacion(idx, 'tablaOrigen', e.target.value)} 
                                        className="h-8 px-2 bg-card text-card-foreground border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none max-w-[130px]"
                                    >
                                        {def.tablas.map((t: any) => <option key={t.nombreTabla} value={t.nombreTabla}>{t.nombreTabla}</option>)}
                                    </select>
                                    <span className="text-xs text-slate-400">.</span>
                                    <select 
                                        value={rel.campoOrigen || ''} 
                                        onChange={e => updateRelacion(idx, 'campoOrigen', e.target.value)} 
                                        className="h-8 px-2 bg-card text-card-foreground border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none max-w-[130px]"
                                    >
                                        <option value="">- Campo Origen -</option>
                                        {tablas.find(t => t.nombreTabla === rel.tablaOrigen)?.campos?.map((c: any) => (
                                            <option key={c.id} value={c.nombreCampo}>{c.nombreCampo}</option>
                                        ))}
                                    </select>

                                    <span className="text-xs font-bold text-slate-400">=</span>

                                    <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-muted text-foreground/80">{rel.tablaDestino || '?'}</span>
                                    <span className="text-xs text-slate-400">.</span>
                                    <select 
                                        value={rel.campoDestino || ''} 
                                        onChange={e => updateRelacion(idx, 'campoDestino', e.target.value)} 
                                        className="h-8 px-2 bg-card text-card-foreground border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none max-w-[130px]"
                                    >
                                        <option value="">- Campo Destino -</option>
                                        {tablas.find(t => t.nombreTabla === rel.tablaDestino)?.campos?.map((c: any) => (
                                            <option key={c.id} value={c.nombreCampo}>{c.nombreCampo}</option>
                                        ))}
                                    </select>

                                    <button 
                                        type="button"
                                        onClick={() => removeRelacion(idx)} 
                                        className="ml-auto p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors"
                                        title="Eliminar JOIN"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 3. Selección de Columnas y Agregaciones */}
                <div className="bg-card text-card-foreground p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                <Type className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                3. Columnas y Métricas a Mostrar ({def.campos?.length || 0} seleccionadas)
                            </h3>
                            <p className="text-xs text-slate-400 mt-0.5">Elegí qué campos incluir y aplicá agregaciones como SUM, COUNT o AVG.</p>
                        </div>
                    </div>

                    {def.campos && def.campos.length > 0 && (
                        <div className="mb-4 p-3 bg-indigo-50/60 dark:bg-indigo-950/40 rounded-xl border border-indigo-100 dark:border-indigo-900/60">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wide">
                                    Columnas en la Consulta ({def.campos.length})
                                </span>
                                <button
                                    type="button"
                                    onClick={() => onChange({ ...def, campos: [] })}
                                    className="text-[10px] text-slate-400 hover:text-rose-500 transition-colors font-medium"
                                >
                                    Quitar todas
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {def.campos.map((c: any, idx: number) => (
                                    <span 
                                        key={idx}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-card text-foreground border border-slate-200 dark:border-slate-700 shadow-xs"
                                    >
                                        <span className="text-slate-400 text-[10px] font-mono">{c.tabla}.</span>
                                        <span>{c.nombreCampo}</span>
                                        {c.funcion && (
                                            <span className="text-[9px] px-1 py-0.2 rounded bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-bold uppercase font-mono">
                                                {c.funcion}
                                            </span>
                                        )}
                                        {c.alias && (
                                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
                                                → {c.alias}
                                            </span>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => toggleCampo(c.tabla, c.nombreCampo)}
                                            className="ml-1 text-slate-400 hover:text-rose-500 rounded p-0.5"
                                            title="Quitar columna"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    {tablasDisponibles.map(tablaInfo => {
                        const search = (fieldSearch[tablaInfo.nombreTabla] || '').toLowerCase();
                        const camposFiltrados = (tablaInfo.campos || []).filter((c: any) => 
                            c.nombreCampo.toLowerCase().includes(search) || (c.tipoDato || '').toLowerCase().includes(search)
                        );
                        const selectedInTable = (def.campos || []).filter((x: any) => x.tabla === tablaInfo.nombreTabla);

                        return (
                            <div key={tablaInfo.id} className="mb-6 last:mb-0 p-4 rounded-xl bg-slate-50/60 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800">
                                <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200 dark:border-slate-800 flex-wrap gap-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                                            {tablaInfo.nombreTabla}
                                        </span>
                                        <span className="text-[10px] font-bold text-slate-400 bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                                            {selectedInTable.length} de {tablaInfo.campos?.length || 0}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <div className="relative">
                                            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input 
                                                type="text" 
                                                value={fieldSearch[tablaInfo.nombreTabla] || ''}
                                                onChange={e => setFieldSearch(p => ({ ...p, [tablaInfo.nombreTabla]: e.target.value }))}
                                                placeholder="Buscar campo..."
                                                className="h-7 pl-8 pr-2 text-xs bg-card text-card-foreground border border-slate-200 dark:border-slate-700 rounded-lg outline-none w-36 focus:w-48 transition-all"
                                            />
                                        </div>
                                        <button 
                                            type="button" 
                                            onClick={() => selectAllCampos(tablaInfo.nombreTabla)}
                                            className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 px-2 py-1 rounded transition-colors"
                                        >
                                            Todos
                                        </button>
                                        <button 
                                            type="button" 
                                            onClick={() => deselectAllCampos(tablaInfo.nombreTabla)}
                                            className="text-[10px] font-bold text-slate-400 hover:text-slate-600 px-2 py-1 rounded transition-colors"
                                        >
                                            Limpiar
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                                    {camposFiltrados.map((c: any) => {
                                        const campoSeleccionado = (def.campos || []).find((x: any) => x.nombreCampo === c.nombreCampo && x.tabla === tablaInfo.nombreTabla);
                                        const isSelected = !!campoSeleccionado;
                                        return (
                                            <div 
                                                key={c.id} 
                                                className={`flex flex-col gap-1.5 p-2.5 rounded-xl border transition-all ${
                                                    isSelected 
                                                        ? 'bg-indigo-50/70 border-indigo-300 dark:bg-indigo-950/40 dark:border-indigo-800 ring-1 ring-indigo-500/30' 
                                                        : 'bg-card text-card-foreground border-slate-200 dark:border-slate-800 hover:border-slate-300'
                                                }`}
                                            >
                                                <label className="flex items-start gap-2 cursor-pointer min-w-0 select-none">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={isSelected}
                                                        onChange={() => toggleCampo(tablaInfo.nombreTabla, c.nombreCampo)}
                                                        className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                                                    />
                                                    <div className="min-w-0 flex-1">
                                                        <div className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate" title={c.nombreCampo}>
                                                            {c.nombreCampo}
                                                        </div>
                                                        <div className="text-[10px] text-slate-400 uppercase font-mono">
                                                            {c.tipoDato}
                                                        </div>
                                                    </div>
                                                </label>
                                                
                                                {isSelected && (
                                                    <div className="pl-6 pt-1.5 border-t border-indigo-100 dark:border-indigo-900/50 mt-1 flex flex-col gap-1">
                                                        <select 
                                                            value={campoSeleccionado.funcion || ''}
                                                            onChange={(e) => updateCampoFuncion(tablaInfo.nombreTabla, c.nombreCampo, e.target.value)}
                                                            className="h-6 w-full px-1.5 text-[10px] font-semibold bg-background border border-slate-200 dark:border-slate-700 rounded outline-none text-slate-700 dark:text-slate-300"
                                                        >
                                                            <option value="">(Sin función - Directo)</option>
                                                            <option value="COUNT">COUNT - Contar</option>
                                                            <option value="SUM">SUM - Sumar</option>
                                                            <option value="AVG">AVG - Promedio</option>
                                                            <option value="MIN">MIN - Mínimo</option>
                                                            <option value="MAX">MAX - Máximo</option>
                                                            <option value="DISTINCT">DISTINCT - Valores Únicos</option>
                                                        </select>

                                                        <input 
                                                            type="text" 
                                                            value={campoSeleccionado.alias || ''}
                                                            onChange={e => updateCampoAlias(tablaInfo.nombreTabla, c.nombreCampo, e.target.value)}
                                                            placeholder={campoSeleccionado.funcion ? `Alias (ej: ${c.nombreCampo}_${campoSeleccionado.funcion.toLowerCase()})` : 'Alias opcional...'}
                                                            className="h-6 px-1.5 text-[10px] bg-background border border-slate-200 dark:border-slate-700 rounded outline-none text-slate-700 dark:text-slate-300 focus:border-indigo-500"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* 4. Filtros (Condiciones WHERE) */}
                <div className="bg-card text-card-foreground p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                <Filter className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                4. Filtros (Condiciones WHERE)
                            </h3>
                            <p className="text-xs text-slate-400 mt-0.5">Restringí las filas devueltas según criterios de negocio.</p>
                        </div>
                        <button 
                            type="button"
                            onClick={addFiltro} 
                            className="h-8 px-3 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                        >
                            <Plus className="w-3.5 h-3.5" /> Agregar Filtro
                        </button>
                    </div>
                    
                    {(!def.filtros || def.filtros.length === 0) ? (
                        <div className="py-4 text-center text-slate-400 text-xs italic bg-slate-50/50 dark:bg-slate-900/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                            Sin filtros aplicados. Se traerán todos los registros de la tabla.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {def.filtros.map((f: any, idx: number) => (
                                <div key={idx} className="flex flex-wrap items-center gap-2 bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                                    {idx > 0 && (
                                        <select 
                                            value={f.conector || 'AND'} 
                                            onChange={e => updateFiltro(idx, 'conector', e.target.value)} 
                                            className="h-8 px-2 bg-card text-xs font-black text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-700 rounded-lg outline-none"
                                        >
                                            <option value="AND">Y (AND)</option>
                                            <option value="OR">O (OR)</option>
                                        </select>
                                    )}
                                    {idx === 0 && (
                                        <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 w-16 text-center">
                                            DONDE
                                        </span>
                                    )}

                                    <select 
                                        value={f.campo || ''} 
                                        onChange={e => updateFiltro(idx, 'campo', e.target.value)} 
                                        className="h-8 px-2.5 bg-card text-card-foreground border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none font-medium max-w-[200px]"
                                    >
                                        <option value="">- Seleccionar Campo -</option>
                                        {todosLosCampos.map(c => (
                                            <option key={c.id} value={c.id}>{c.label}</option>
                                        ))}
                                    </select>

                                    <select 
                                        value={f.operador || 'EQUAL'} 
                                        onChange={e => updateFiltro(idx, 'operador', e.target.value)} 
                                        className="h-8 px-2.5 bg-card text-card-foreground border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none font-semibold text-slate-700 dark:text-slate-300"
                                    >
                                        <option value="EQUAL">Igual a (=)</option>
                                        <option value="NOT_EQUAL">Distinto a (!=)</option>
                                        <option value="ILIKE">Contiene texto (ILIKE insensible)</option>
                                        <option value="LIKE">Contiene exacto (LIKE)</option>
                                        <option value="NOT_LIKE">No contiene (NOT LIKE)</option>
                                        <option value="GREATER">Mayor que (&gt;)</option>
                                        <option value="LESS">Menor que (&lt;)</option>
                                        <option value="GREATER_EQUAL">Mayor o igual (&gt;=)</option>
                                        <option value="LESS_EQUAL">Menor o igual (&lt;=)</option>
                                        <option value="IN">En lista (IN: a,b,c)</option>
                                        <option value="NOT_IN">No en lista (NOT IN)</option>
                                        <option value="BETWEEN">Entre dos valores (BETWEEN)</option>
                                        <option value="IS_NULL">Es nulo (IS NULL)</option>
                                        <option value="IS_NOT_NULL">No es nulo (IS NOT NULL)</option>
                                    </select>

                                    {f.operador !== 'IS_NULL' && f.operador !== 'IS_NOT_NULL' && (
                                        <div className="flex-1 flex flex-col gap-1 min-w-[200px]">
                                            <div className="flex items-center gap-1.5">
                                                <input 
                                                    type="text" 
                                                    value={f.valor || ''} 
                                                    onChange={e => updateFiltro(idx, 'valor', e.target.value)} 
                                                    placeholder="Valor o variable (ej: {{FECHA_ACTUAL}})..."
                                                    className="h-8 px-3 bg-card text-card-foreground border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none w-full focus:border-indigo-500 font-mono"
                                                />
                                                {f.operador === 'BETWEEN' && (
                                                    <>
                                                        <span className="text-xs font-bold text-slate-400">hasta</span>
                                                        <input 
                                                            type="text" 
                                                            value={f.valor2 || ''} 
                                                            onChange={e => updateFiltro(idx, 'valor2', e.target.value)} 
                                                            placeholder="Segundo valor..."
                                                            className="h-8 px-3 bg-card text-card-foreground border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none w-full focus:border-indigo-500 font-mono"
                                                        />
                                                    </>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-1">
                                                <span className="text-[9px] text-slate-400 font-bold uppercase">Insertar:</span>
                                                {['{{FECHA_ACTUAL}}', '{{INICIO_MES}}', '{{FIN_MES}}', '{{AYER}}', '{{HACE_7_DIAS}}'].map(v => (
                                                    <button
                                                        key={v}
                                                        type="button"
                                                        onClick={() => updateFiltro(idx, 'valor', v)}
                                                        className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-100 dark:hover:bg-indigo-950 transition-colors"
                                                    >
                                                        {v}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <button 
                                        type="button"
                                        onClick={() => removeFiltro(idx)} 
                                        className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors"
                                        title="Eliminar condición"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 5. Ordenamiento (ORDER BY) */}
                <div className="bg-card text-card-foreground p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                <ArrowUpDown className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                5. Ordenamiento (ORDER BY)
                            </h3>
                            <p className="text-xs text-slate-400 mt-0.5">Definí el orden de los datos (ej: más recientes primero).</p>
                        </div>
                        <button 
                            type="button"
                            onClick={addOrden} 
                            className="h-8 px-3 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                        >
                            <Plus className="w-3.5 h-3.5" /> Agregar Orden
                        </button>
                    </div>

                    {(!def.ordenamiento || def.ordenamiento.length === 0) ? (
                        <div className="py-4 text-center text-slate-400 text-xs italic bg-slate-50/50 dark:bg-slate-900/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                            Sin orden explícito. Los datos se mostrarán en orden natural de inserción.
                        </div>
                    ) : (
                        <div className="space-y-2.5">
                            {def.ordenamiento.map((o: any, idx: number) => (
                                <div key={idx} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                                    <span className="text-xs font-bold text-slate-400 w-6 text-center">#{idx + 1}</span>
                                    <select 
                                        value={o.campo || ''} 
                                        onChange={e => updateOrden(idx, 'campo', e.target.value)} 
                                        className="h-8 px-2.5 bg-card text-card-foreground border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none flex-1 max-w-sm"
                                    >
                                        <option value="">- Seleccionar Campo -</option>
                                        {todosLosCampos.map(c => (
                                            <option key={c.id} value={c.id}>{c.label}</option>
                                        ))}
                                    </select>

                                    <select 
                                        value={o.direccion || 'ASC'} 
                                        onChange={e => updateOrden(idx, 'direccion', e.target.value)} 
                                        className="h-8 px-2.5 bg-card text-card-foreground border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none font-bold text-indigo-600 dark:text-indigo-400"
                                    >
                                        <option value="ASC">Ascendente (ASC - A a Z / 0 a 9)</option>
                                        <option value="DESC">Descendente (DESC - Z a A / 9 a 0 / Recientes)</option>
                                    </select>

                                    <button 
                                        type="button"
                                        onClick={() => removeOrden(idx)} 
                                        className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors"
                                        title="Eliminar regla de orden"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 6. SQL Generado en Vivo */}
                <div className="bg-card text-card-foreground p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <button 
                        type="button"
                        onClick={() => setShowGeneratedSQL(!showGeneratedSQL)}
                        className="flex items-center justify-between w-full text-left"
                    >
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                                SQL Generado Automáticamente
                            </span>
                        </div>
                        <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
                            {showGeneratedSQL ? 'Ocultar' : 'Ver SQL'}
                        </span>
                    </button>

                    {showGeneratedSQL && (
                        <div className="mt-3">
                            <pre className="p-3 bg-slate-900 text-slate-200 font-mono text-xs rounded-xl overflow-x-auto leading-relaxed border border-slate-800 select-all">
                                {generatedSQL || '-- Definí al menos un campo para generar el SQL'}
                            </pre>
                        </div>
                    )}
                </div>
                </>
            )}
        </div>
    );
}
