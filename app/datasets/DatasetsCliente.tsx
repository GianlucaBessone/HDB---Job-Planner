'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Database, Plus, Play, Activity, Edit2, Code, LayoutDashboard, Clock, History, AlertTriangle, Eye, Table as TableIcon } from 'lucide-react';
import DatasetFormModal from './DatasetFormModal';
import DatasetPreviewModal from './DatasetPreviewModal';
import DatasetHistoryModal from './DatasetHistoryModal';
import { showToast } from '@/components/Toast';
import ConfirmModal from '@/components/ConfirmModal';

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
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSaveDataset = async (data: any) => {
        const url = editingDataset ? `/api/datasets/${editingDataset.id}` : '/api/datasets';
        const method = editingDataset ? 'PUT' : 'POST';
        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (res.ok) {
                setShowFormModal(false);
                setEditingDataset(null);
                fetchData();
            } else {
                const err = await res.json();
                showToast(`Error: ${err.error}${err.detalles ? `\n${err.detalles.join('\n')}` : ''}`, 'error');
            }
        } catch (err) { console.error(err); }
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
        } catch (err) { console.error(err); }
        finally { setExecuting(null); }
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
        } catch (err) { console.error(err); }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <Database className="w-7 h-7 text-indigo-600" /> Datasets
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">Motor de Datasets y consultas para KPIs y Gráficos.</p>
                </div>
                <button 
                    onClick={() => { setEditingDataset(null); setShowFormModal(true); }} 
                    className="flex items-center gap-2 h-10 px-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-sm transition-all"
                >
                    <Plus className="w-4 h-4" /> Nuevo Dataset
                </button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20"><div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" /></div>
            ) : datasets.length === 0 ? (
                <div className="bg-card text-card-foreground border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-12 text-center">
                    <Database className="w-12 h-12 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
                    <h3 className="text-lg font-bold text-slate-600 dark:text-slate-300 mb-1">Sin Datasets</h3>
                    <p className="text-sm text-slate-400">Creá tu primer Dataset para extraer información.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {datasets.map(ds => (
                        <div key={ds.id} className="bg-card text-card-foreground border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm hover:shadow-md transition-all p-5 flex flex-col group">
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-md uppercase tracking-wider">{ds.codigoDataset}</span>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase ${
                                            ds.estado === 'Activo' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                            ds.estado === 'Error' ? 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400' :
                                            'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                                        }`}>{ds.estado}</span>
                                        {!ds.habilitado && <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-md uppercase">Deshabilitado</span>}
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{ds.nombre}</h3>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => setShowPreviewModal(ds)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-indigo-600" title="Previsualizar">
                                        <Eye className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => { setEditingDataset(ds); setShowFormModal(true); }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-indigo-600" title="Editar">
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-4 flex-1">{ds.descripcion || 'Sin descripción'}</p>
                            
                            <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 dark:text-slate-400 mb-4 bg-background text-foreground/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                                <div className="flex items-center gap-1.5"><TableIcon className="w-3.5 h-3.5 text-slate-400" /> {ds.modoConsulta === 'SQL' ? 'Query SQL' : 'Visual Builder'}</div>
                                <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-slate-400" /> {ds.tipoEjecucion === 'Manual' ? 'Manual' : `Prog: ${ds.frecuencia}`}</div>
                                <div className="flex items-center gap-1.5"><Activity className="w-3.5 h-3.5 text-slate-400" /> KPIs: {ds._count?.kpisAsociados || 0}</div>
                                <div className="flex items-center gap-1.5"><LayoutDashboard className="w-3.5 h-3.5 text-slate-400" /> Gráficos: {ds._count?.graficosAsociados || 0}</div>
                            </div>

                            <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-700 pt-3 mt-auto">
                                <button onClick={() => setShowHistoryModal(ds)} className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-indigo-600 transition-colors">
                                    <History className="w-3.5 h-3.5" /> Historial ({ds._count?.historico || 0})
                                </button>
                                <button 
                                    onClick={() => handleExecute(ds.id)} 
                                    disabled={executing === ds.id}
                                    className="flex items-center gap-1.5 h-8 px-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-lg text-xs font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-all disabled:opacity-50"
                                >
                                    <Play className={`w-3.5 h-3.5 ${executing === ds.id ? 'animate-pulse' : ''}`} /> 
                                    {executing === ds.id ? 'Ejecutando...' : 'Ejecutar'}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showFormModal && <DatasetFormModal dataset={editingDataset} operators={operators} onClose={() => { setShowFormModal(false); setEditingDataset(null); }} onSave={handleSaveDataset} />}
            {showPreviewModal && <DatasetPreviewModal dataset={showPreviewModal} onClose={() => setShowPreviewModal(null)} />}
            {showHistoryModal && <DatasetHistoryModal dataset={showHistoryModal} onClose={() => setShowHistoryModal(null)} />}
            <ConfirmModal 
                isOpen={datasetToDelete !== null} 
                onClose={() => setDatasetToDelete(null)} 
                onConfirm={() => { if (datasetToDelete) executeDelete(datasetToDelete); }} 
                title="Eliminar Dataset" 
                message="¿Seguro que deseas eliminar este dataset? Esta acción no se puede deshacer." 
                isDestructive={true} 
            />
        </div>
    );
}
