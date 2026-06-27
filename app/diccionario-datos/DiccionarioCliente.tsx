'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Database, RefreshCw, Search, Eye, EyeOff, Edit2, X, Table as TableIcon, Key } from 'lucide-react';
import { showToast } from '@/components/Toast';

export default function DiccionarioCliente({ user }: { user: any }) {
    const [tablas, setTablas] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [search, setSearch] = useState('');
    const [incluirOcultas, setIncluirOcultas] = useState(false);
    const [selectedTabla, setSelectedTabla] = useState<any | null>(null);
    const [loadingDetalle, setLoadingDetalle] = useState(false);
    const [editingCampo, setEditingCampo] = useState<any | null>(null);
    const [syncProgress, setSyncProgress] = useState<{ actual: number; total: number; tablaActual: string } | null>(null);

    const fetchTablas = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/diccionario-datos?incluirOcultas=${incluirOcultas}`);
            if (res.ok) setTablas(await res.json());
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    }, [incluirOcultas]);

    useEffect(() => {
        fetchTablas();
    }, [fetchTablas]);

    const handleSync = async () => {
        setSyncing(true);
        setSyncProgress({ actual: 0, total: 0, tablaActual: 'Iniciando...' });
        try {
            // Fase 1: Obtener lista de tablas
            const resStart = await fetch('/api/diccionario-datos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'sync-start' }),
            });
            const dataStart = await resStart.json();
            
            if (!dataStart.tables) {
                throw new Error(dataStart.error || 'Error al iniciar sincronización');
            }
            
            const tablasASincronizar: string[] = dataStart.tables;
            const totalTablas = tablasASincronizar.length;
            let actual = 0;
            
            // Fase 2: Sincronizar tabla por tabla
            for (const tabla of tablasASincronizar) {
                actual++;
                setSyncProgress({ actual, total: totalTablas, tablaActual: tabla });
                
                await fetch('/api/diccionario-datos', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'sync-table', tabla }),
                });
            }
            
            // Fase 3: Finalizar y limpiar
            setSyncProgress({ actual: totalTablas, total: totalTablas, tablaActual: 'Limpiando datos huérfanos...' });
            const resFinish = await fetch('/api/diccionario-datos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'sync-finish', validTables: tablasASincronizar }),
            });
            
            const dataFinish = await resFinish.json();
            if (dataFinish.success) {
                showToast('Sincronización completada con éxito', 'success');
                fetchTablas();
            } else {
                throw new Error(dataFinish.error || 'Error en la limpieza');
            }

        } catch (err: any) { 
            console.error(err); 
            showToast(err.message || 'Error de conexión durante la sincronización', 'error');
        }
        finally { 
            setSyncing(false); 
            setSyncProgress(null);
        }
    };

    const handleSelectTabla = async (tablaId: string) => {
        setLoadingDetalle(true);
        try {
            const res = await fetch(`/api/diccionario-datos/${tablaId}`);
            if (res.ok) setSelectedTabla(await res.json());
        } catch (err) { console.error(err); }
        finally { setLoadingDetalle(false); }
    };

    const handleToggleOculta = async (tablaId: string, ocultaActual: boolean) => {
        try {
            const res = await fetch(`/api/diccionario-datos/${tablaId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ oculta: !ocultaActual }),
            });
            if (res.ok) {
                fetchTablas();
                if (selectedTabla?.id === tablaId) {
                    setSelectedTabla(await res.json());
                }
            }
        } catch (err) { console.error(err); }
    };

    const handleUpdateDescripcionTabla = async (tablaId: string, descripcion: string) => {
        try {
            const res = await fetch(`/api/diccionario-datos/${tablaId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ descripcion }),
            });
            if (res.ok) {
                fetchTablas();
                if (selectedTabla?.id === tablaId) {
                    setSelectedTabla(await res.json());
                }
            }
        } catch (err) { console.error(err); }
    };

    const handleSaveCampoDescripcion = async (campoId: string, descripcion: string) => {
        if (!selectedTabla) return;
        try {
            const res = await fetch(`/api/diccionario-datos/${selectedTabla.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ campos: [{ id: campoId, descripcion }] }),
            });
            if (res.ok) {
                setSelectedTabla(await res.json());
                setEditingCampo(null);
            }
        } catch (err) { console.error(err); }
    };

    const filteredTablas = tablas.filter(t => t.nombreTabla.toLowerCase().includes(search.toLowerCase()) || (t.descripcion && t.descripcion.toLowerCase().includes(search.toLowerCase())));

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <Database className="w-7 h-7 text-indigo-600" /> Diccionario de Datos
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">Metadatos e introspección de la base de datos para la generación de Datasets.</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                    <button 
                        onClick={handleSync} 
                        disabled={syncing}
                        className="flex items-center gap-2 h-10 px-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-sm transition-all disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                        {syncing ? 'Sincronizando...' : 'Sincronizar Esquema'}
                    </button>
                    {syncing && syncProgress && syncProgress.total > 0 && (
                        <div className="w-full max-w-xs flex flex-col items-end gap-1">
                            <span className="text-xs text-slate-500 truncate max-w-[200px]">Analizando {syncProgress.tablaActual}</span>
                            <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-indigo-600 transition-all duration-300"
                                    style={{ width: `${(syncProgress.actual / syncProgress.total) * 100}%` }}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Lista de tablas */}
                <div className="lg:col-span-1 flex flex-col h-[calc(100vh-12rem)] bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="p-4 border-b border-slate-200 dark:border-slate-700 space-y-3">
                        <div className="relative">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                placeholder="Buscar tablas..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-full h-10 pl-9 pr-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            />
                        </div>
                        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
                            <input 
                                type="checkbox" 
                                checked={incluirOcultas} 
                                onChange={e => setIncluirOcultas(e.target.checked)}
                                className="rounded text-indigo-600"
                            />
                            Mostrar tablas ocultas
                        </label>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {loading ? (
                            <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" /></div>
                        ) : filteredTablas.length === 0 ? (
                            <div className="text-center p-6 text-sm text-slate-400">No se encontraron tablas.</div>
                        ) : (
                            filteredTablas.map(tabla => (
                                <button
                                    key={tabla.id}
                                    onClick={() => handleSelectTabla(tabla.id)}
                                    className={`w-full text-left p-3 rounded-xl flex items-center justify-between transition-all ${
                                        selectedTabla?.id === tabla.id 
                                            ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800' 
                                            : 'hover:bg-slate-50 dark:hover:bg-slate-750 border-transparent'
                                    } border`}
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <TableIcon className={`w-4 h-4 ${selectedTabla?.id === tabla.id ? 'text-indigo-600' : 'text-slate-400'}`} />
                                            <span className={`font-bold truncate text-sm ${selectedTabla?.id === tabla.id ? 'text-indigo-900 dark:text-indigo-100' : 'text-slate-700 dark:text-slate-200'}`}>
                                                {tabla.nombreTabla}
                                            </span>
                                            {tabla.oculta && <EyeOff className="w-3 h-3 text-rose-500 shrink-0" />}
                                        </div>
                                        <div className="text-xs text-slate-400 mt-1 truncate">
                                            {tabla.descripcion || 'Sin descripción'}
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-1 rounded-lg shrink-0 ml-2">
                                        {tabla._count?.campos || 0} cols
                                    </span>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* Detalle de la tabla */}
                <div className="lg:col-span-2 flex flex-col h-[calc(100vh-12rem)] bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                    {loadingDetalle ? (
                        <div className="flex-1 flex items-center justify-center"><div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" /></div>
                    ) : !selectedTabla ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                            <TableIcon className="w-16 h-16 mb-4 text-slate-200 dark:text-slate-700" />
                            <h3 className="text-lg font-bold text-slate-600 dark:text-slate-300">Seleccione una tabla</h3>
                            <p className="text-sm mt-1">Elija una tabla del listado para ver y editar su diccionario de datos.</p>
                        </div>
                    ) : (
                        <>
                            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                            <TableIcon className="w-6 h-6 text-indigo-600" /> {selectedTabla.nombreTabla}
                                        </h2>
                                        <div className="text-xs text-slate-400 mt-1">Última sincronización: {new Date(selectedTabla.ultimaSincronizacion).toLocaleString()}</div>
                                    </div>
                                    <button
                                        onClick={() => handleToggleOculta(selectedTabla.id, selectedTabla.oculta)}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                            selectedTabla.oculta 
                                                ? 'bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-900/30 dark:text-rose-400' 
                                                : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400'
                                        }`}
                                    >
                                        {selectedTabla.oculta ? <><EyeOff className="w-3.5 h-3.5" /> Oculta</> : <><Eye className="w-3.5 h-3.5" /> Visible</>}
                                    </button>
                                </div>
                                <div className="relative group">
                                    <textarea
                                        value={selectedTabla.descripcion || ''}
                                        onChange={e => setSelectedTabla({ ...selectedTabla, descripcion: e.target.value })}
                                        onBlur={e => handleUpdateDescripcionTabla(selectedTabla.id, e.target.value)}
                                        placeholder="Añadir una descripción para esta tabla (recomendado)..."
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white dark:focus:bg-slate-900 transition-all resize-none"
                                        rows={2}
                                    />
                                    <Edit2 className="w-3 h-3 text-slate-400 absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto">
                                <table className="w-full text-left text-sm whitespace-nowrap">
                                    <thead className="bg-slate-50 dark:bg-slate-900/50 sticky top-0 z-10 shadow-sm">
                                        <tr>
                                            <th className="px-4 py-3 font-bold text-slate-500 uppercase text-[10px] tracking-wider w-10">PK/FK</th>
                                            <th className="px-4 py-3 font-bold text-slate-500 uppercase text-[10px] tracking-wider">Columna</th>
                                            <th className="px-4 py-3 font-bold text-slate-500 uppercase text-[10px] tracking-wider">Tipo SQL</th>
                                            <th className="px-4 py-3 font-bold text-slate-500 uppercase text-[10px] tracking-wider w-full">Descripción (Alias)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {selectedTabla.campos.map((campo: any) => (
                                            <tr key={campo.id} className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/50 ${campo.esClavePrimaria ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : ''}`}>
                                                <td className="px-4 py-3">
                                                    {campo.esClavePrimaria && <span title="Primary Key"><Key className="w-4 h-4 text-amber-500" /></span>}
                                                    {campo.esClaveForanea && <span title={`Foreign Key: ${campo.tablaReferenciada}`}><Key className="w-4 h-4 text-indigo-400" /></span>}
                                                </td>
                                                <td className="px-4 py-3 font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                                                    {campo.nombreCampo}
                                                    {!campo.permiteNulos && <span className="text-rose-500 ml-1" title="Not Null">*</span>}
                                                </td>
                                                <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                                                    {campo.tipoDato}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {editingCampo === campo.id ? (
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="text"
                                                                autoFocus
                                                                defaultValue={campo.descripcion || ''}
                                                                onKeyDown={e => {
                                                                    if (e.key === 'Enter') handleSaveCampoDescripcion(campo.id, e.currentTarget.value);
                                                                    if (e.key === 'Escape') setEditingCampo(null);
                                                                }}
                                                                onBlur={e => handleSaveCampoDescripcion(campo.id, e.target.value)}
                                                                className="w-full h-8 px-2 text-xs border border-indigo-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div 
                                                            className="flex items-center justify-between group/desc cursor-pointer"
                                                            onClick={() => setEditingCampo(campo.id)}
                                                        >
                                                            <span className={`text-xs truncate ${campo.descripcion ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400 italic'}`}>
                                                                {campo.descripcion || 'Sin descripción'}
                                                            </span>
                                                            <Edit2 className="w-3 h-3 text-slate-300 opacity-0 group-hover/desc:opacity-100 transition-opacity shrink-0 ml-2" />
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
