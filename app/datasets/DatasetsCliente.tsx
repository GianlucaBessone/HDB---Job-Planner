'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
    Database, Plus, Play, Activity, Edit2, Code, LayoutDashboard, 
    Clock, History, AlertTriangle, Eye, Table as TableIcon, 
    Trash2, Copy, Search, Filter, CheckCircle2, XCircle, ArrowUpRight,
    RefreshCw, Layers
} from 'lucide-react';
import DatasetFormModal from './DatasetFormModal';
import DatasetPreviewModal from './DatasetPreviewModal';
import DatasetHistoryModal from './DatasetHistoryModal';
import { showToast } from '@/components/Toast';
import ConfirmModal from '@/components/ConfirmModal';

type FilterType = 'todos' | 'sql' | 'visual' | 'activos' | 'programados' | 'error';

export default function DatasetsCliente({ user }: { user: any }) {
    const [datasets, setDatasets] = useState<any[]>([]);
    const [operators, setOperators] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showFormModal, setShowFormModal] = useState(false);
    const [showPreviewModal, setShowPreviewModal] = useState<any | null>(null);
    const [showHistoryModal, setShowHistoryModal] = useState<any | null>(null);
    const [editingDataset, setEditingDataset] = useState<any>(null);
    const [executing, setExecuting] = useState<string | null>(null);
    const [datasetToDelete, setDatasetToDelete] = useState<string | null>(null);
    
    // Search and filter state
    const [searchQuery, setSearchQuery] = useState('');
    const [filterTab, setFilterTab] = useState<FilterType>('todos');

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [dsRes, opRes] = await Promise.all([
                fetch('/api/datasets'),
                fetch('/api/operators'),
            ]);
            if (dsRes.ok) setDatasets(await dsRes.json());
            if (opRes.ok) {
                const data = await opRes.json();
                setOperators(data.filter((o: any) => o.activo));
            }
        } catch (err) { 
            console.error(err); 
            showToast('Error al cargar datasets', 'error');
        } finally { 
            setLoading(false); 
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSaveDataset = async (data: any) => {
        const isEditing = editingDataset && editingDataset.id;
        const url = isEditing ? `/api/datasets/${editingDataset.id}` : '/api/datasets';
        const method = isEditing ? 'PUT' : 'POST';
        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (res.ok) {
                setShowFormModal(false);
                setEditingDataset(null);
                showToast(isEditing ? 'Dataset actualizado correctamente.' : 'Dataset creado correctamente.', 'success');
                fetchData();
            } else {
                const err = await res.json().catch(() => ({ error: 'Error inesperado del servidor' }));
                showToast(`Error: ${err.error || 'Error del servidor'}${err.detalles ? `\n${err.detalles.join('\n')}` : ''}`, 'error');
            }
        } catch (err: any) {
            console.error(err);
            showToast(`Error de conexión: ${err.message || 'Error de red'}`, 'error');
        }
    };

    const handleExecute = async (datasetId: string) => {
        setExecuting(datasetId);
        try {
            const res = await fetch(`/api/datasets/${datasetId}/ejecutar`, { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                showToast(`Ejecución exitosa en ${data.duracionMs}ms. Registros: ${data.cantidadRegistros}`, 'success');
                fetchData();
            } else {
                showToast(`Error de ejecución: ${data.error}`, 'error');
            }
        } catch (err) { 
            console.error(err); 
            showToast('Error al ejecutar el dataset', 'error');
        } finally { 
            setExecuting(null); 
        }
    };

    const handleDuplicate = (ds: any) => {
        const clone = {
            ...ds,
            id: undefined,
            codigoDataset: undefined,
            nombre: `${ds.nombre} (Copia)`,
            descripcion: ds.descripcion ? `${ds.descripcion} - Copia` : '',
        };
        setEditingDataset(clone);
        setShowFormModal(true);
        showToast(`Clonando "${ds.nombre}" como nuevo dataset`, 'info');
    };

    const handleDelete = (datasetId: string) => {
        setDatasetToDelete(datasetId);
    };

    const executeDelete = async (datasetId: string) => {
        try {
            const res = await fetch(`/api/datasets/${datasetId}`, { method: 'DELETE' });
            if (res.ok) {
                showToast('Dataset eliminado correctamente.', 'success');
                fetchData();
            } else {
                const err = await res.json();
                showToast(`Error: ${err.error}`, 'error');
            }
        } catch (err) { 
            console.error(err); 
            showToast('Error de conexión al eliminar', 'error');
        } finally {
            setDatasetToDelete(null);
        }
    };

    // Filtered and searched datasets
    const filteredDatasets = useMemo(() => {
        return datasets.filter(ds => {
            // Text search
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const matchName = ds.nombre?.toLowerCase().includes(q);
                const matchCode = ds.codigoDataset?.toLowerCase().includes(q);
                const matchDesc = ds.descripcion?.toLowerCase().includes(q);
                const matchSQL = ds.consultaSQL?.toLowerCase().includes(q);
                if (!matchName && !matchCode && !matchDesc && !matchSQL) return false;
            }

            // Tab filter
            if (filterTab === 'sql') return ds.modoConsulta === 'SQL';
            if (filterTab === 'visual') return ds.modoConsulta === 'Visual';
            if (filterTab === 'activos') return ds.estado === 'Activo' && ds.habilitado !== false;
            if (filterTab === 'programados') return ds.tipoEjecucion === 'Programada';
            if (filterTab === 'error') return ds.estado === 'Error';

            return true;
        });
    }, [datasets, searchQuery, filterTab]);

    // Summary statistics
    const stats = useMemo(() => {
        const total = datasets.length;
        const activos = datasets.filter(d => d.estado === 'Activo' && d.habilitado !== false).length;
        const errores = datasets.filter(d => d.estado === 'Error').length;
        const programados = datasets.filter(d => d.tipoEjecucion === 'Programada').length;
        const totalVinculados = datasets.reduce((acc, d) => 
            acc + (d._count?.kpisAsociados || 0) + (d._count?.graficosAsociados || 0), 0
        );
        return { total, activos, errores, programados, totalVinculados };
    }, [datasets]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <Database className="w-7 h-7 text-indigo-600 dark:text-indigo-400" /> Datasets
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Motor de extracción de datos, agregaciones y consultas SQL/Visuales para KPIs y Gráficos.
                    </p>
                </div>
                <div className="flex items-center gap-2.5">
                    <button
                        type="button"
                        onClick={fetchData}
                        disabled={loading}
                        className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Actualizar listado"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <button 
                        onClick={() => { setEditingDataset(null); setShowFormModal(true); }} 
                        className="flex items-center gap-2 h-10 px-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-sm transition-all"
                    >
                        <Plus className="w-4 h-4" /> Nuevo Dataset
                    </button>
                </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-card text-card-foreground p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                        <Layers className="w-4 h-4" />
                    </div>
                    <div>
                        <div className="text-lg font-black text-slate-800 dark:text-slate-100">{stats.total}</div>
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Total Datasets</div>
                    </div>
                </div>

                <div className="bg-card text-card-foreground p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                        <div className="text-lg font-black text-emerald-600 dark:text-emerald-400">{stats.activos}</div>
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Activos</div>
                    </div>
                </div>

                <div className="bg-card text-card-foreground p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-950/60 flex items-center justify-center text-amber-600 dark:text-amber-400">
                        <Clock className="w-4 h-4" />
                    </div>
                    <div>
                        <div className="text-lg font-black text-amber-600 dark:text-amber-400">{stats.programados}</div>
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Programados</div>
                    </div>
                </div>

                <div className="bg-card text-card-foreground p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-rose-50 dark:bg-rose-950/60 flex items-center justify-center text-rose-600 dark:text-rose-400">
                        <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div>
                        <div className="text-lg font-black text-rose-600 dark:text-rose-400">{stats.errores}</div>
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Con Error</div>
                    </div>
                </div>
            </div>

            {/* Search and Filters Toolbar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 custom-scrollbar">
                    {[
                        { key: 'todos', label: 'Todos' },
                        { key: 'sql', label: 'Modo SQL' },
                        { key: 'visual', label: 'Modo Visual' },
                        { key: 'activos', label: 'Activos' },
                        { key: 'programados', label: 'Programados' },
                        { key: 'error', label: 'Con Error' },
                    ].map(tab => (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => setFilterTab(tab.key as FilterType)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                                filterTab === tab.key
                                    ? 'bg-indigo-600 text-white shadow-xs'
                                    : 'bg-card text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="relative w-full sm:w-72">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                        type="text" 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Buscar por nombre, código o SQL..."
                        className="w-full h-9 pl-9 pr-3 text-xs bg-card text-card-foreground border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    />
                    {searchQuery && (
                        <button 
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                            <XCircle className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Datasets Grid */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                    <p className="text-xs text-slate-400">Cargando catálogo de datasets...</p>
                </div>
            ) : filteredDatasets.length === 0 ? (
                <div className="bg-card text-card-foreground border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-12 text-center">
                    <Database className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                    <h3 className="text-base font-bold text-slate-700 dark:text-slate-300 mb-1">
                        {searchQuery || filterTab !== 'todos' ? 'No se encontraron datasets' : 'Sin Datasets Registrados'}
                    </h3>
                    <p className="text-xs text-slate-400 max-w-md mx-auto mb-4">
                        {searchQuery || filterTab !== 'todos'
                            ? 'Probá cambiando el filtro o los términos de búsqueda para encontrar los datasets deseados.'
                            : 'Creá tu primer dataset para consultar la base de datos y alimentar KPIs y gráficos.'}
                    </p>
                    {searchQuery || filterTab !== 'todos' ? (
                        <button 
                            type="button"
                            onClick={() => { setSearchQuery(''); setFilterTab('todos'); }}
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-xs font-bold rounded-xl transition-colors"
                        >
                            Restablecer Filtros
                        </button>
                    ) : (
                        <button 
                            onClick={() => { setEditingDataset(null); setShowFormModal(true); }}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
                        >
                            Crear Nuevo Dataset
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {filteredDatasets.map(ds => {
                        const isSQL = ds.modoConsulta === 'SQL';
                        const lastExecDate = ds.ultimaEjecucion ? new Date(ds.ultimaEjecucion).toLocaleString() : 'Sin ejecución';

                        return (
                            <div 
                                key={ds.id} 
                                className="bg-card text-card-foreground border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs hover:shadow-md transition-all p-5 flex flex-col group relative"
                            >
                                <div className="flex justify-between items-start mb-3 gap-3">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                            <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/40 px-2 py-0.5 rounded uppercase tracking-wider font-mono">
                                                {ds.codigoDataset}
                                            </span>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                                                ds.estado === 'Activo' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400' :
                                                ds.estado === 'Error' ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400' :
                                                'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                            }`}>
                                                {ds.estado}
                                            </span>
                                            <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                                                {isSQL ? 'SQL' : 'Visual'}
                                            </span>
                                            {!ds.habilitado && (
                                                <span className="text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 px-2 py-0.5 rounded uppercase">
                                                    Deshabilitado
                                                </span>
                                            )}
                                        </div>
                                        <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 truncate" title={ds.nombre}>
                                            {ds.nombre}
                                        </h3>
                                    </div>

                                    {/* Action buttons on card header */}
                                    <div className="flex items-center gap-1 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button 
                                            onClick={() => setShowPreviewModal(ds)} 
                                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-indigo-600 transition-colors" 
                                            title="Previsualizar Datos"
                                        >
                                            <Eye className="w-4 h-4" />
                                        </button>
                                        <button 
                                            onClick={() => handleDuplicate(ds)} 
                                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-indigo-600 transition-colors" 
                                            title="Duplicar Dataset"
                                        >
                                            <Copy className="w-4 h-4" />
                                        </button>
                                        <button 
                                            onClick={() => { setEditingDataset(ds); setShowFormModal(true); }} 
                                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-indigo-600 transition-colors" 
                                            title="Editar Dataset"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(ds.id)} 
                                            className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg text-slate-400 hover:text-rose-600 transition-colors" 
                                            title="Eliminar Dataset"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-3.5 flex-1">
                                    {ds.descripcion || 'Sin descripción detallada.'}
                                </p>
                                
                                {/* Info Box */}
                                <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 dark:text-slate-400 mb-3.5 bg-slate-50/70 dark:bg-slate-900/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center gap-1.5 truncate">
                                        <TableIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                        <span className="truncate">{isSQL ? 'Query SQL' : 'Visual Builder'}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 truncate">
                                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" /> 
                                        <span className="truncate">{ds.tipoEjecucion === 'Manual' ? 'Manual' : `Cron: ${ds.frecuencia}`}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <Activity className="w-3.5 h-3.5 text-slate-400 shrink-0" /> 
                                        <span>KPIs: <strong>{ds._count?.kpisAsociados || 0}</strong></span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <LayoutDashboard className="w-3.5 h-3.5 text-slate-400 shrink-0" /> 
                                        <span>Gráficos: <strong>{ds._count?.graficosAsociados || 0}</strong></span>
                                    </div>
                                </div>

                                <div className="text-[11px] text-slate-400 mb-3 flex items-center justify-between">
                                    <span>Última ejec: <strong className="text-slate-600 dark:text-slate-300 font-normal">{lastExecDate}</strong></span>
                                    {ds.limiteRegistros && (
                                        <span className="font-mono text-[10px]">Máx {ds.limiteRegistros} filas</span>
                                    )}
                                </div>

                                {/* Footer actions */}
                                <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3 mt-auto">
                                    <button 
                                        onClick={() => setShowHistoryModal(ds)} 
                                        className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                    >
                                        <History className="w-3.5 h-3.5" /> Historial ({ds._count?.historico || 0})
                                    </button>
                                    <button 
                                        onClick={() => handleExecute(ds.id)} 
                                        disabled={executing === ds.id}
                                        className="flex items-center gap-1.5 h-8 px-3.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-all disabled:opacity-50"
                                    >
                                        <Play className={`w-3.5 h-3.5 ${executing === ds.id ? 'animate-spin' : ''}`} /> 
                                        {executing === ds.id ? 'Ejecutando...' : 'Ejecutar Ahora'}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {showFormModal && (
                <DatasetFormModal 
                    dataset={editingDataset} 
                    operators={operators} 
                    onClose={() => { setShowFormModal(false); setEditingDataset(null); }} 
                    onSave={handleSaveDataset} 
                />
            )}
            {showPreviewModal && (
                <DatasetPreviewModal 
                    dataset={showPreviewModal} 
                    onClose={() => setShowPreviewModal(null)} 
                />
            )}
            {showHistoryModal && (
                <DatasetHistoryModal 
                    dataset={showHistoryModal} 
                    onClose={() => setShowHistoryModal(null)} 
                />
            )}
            <ConfirmModal 
                isOpen={datasetToDelete !== null} 
                onClose={() => setDatasetToDelete(null)} 
                onConfirm={() => { if (datasetToDelete) executeDelete(datasetToDelete); }} 
                title="Eliminar Dataset" 
                message="¿Estás seguro de que deseas eliminar este dataset? Si tiene KPIs vinculados se desactivará automáticamente para preservar la integridad de datos." 
                isDestructive={true} 
            />
        </div>
    );
}
