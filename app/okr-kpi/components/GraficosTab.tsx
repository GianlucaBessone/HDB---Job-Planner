'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Plus, BarChart3, Edit2, X, LineChart, PieChart, Gauge, Activity, Database } from 'lucide-react';

const TIPO_ICONS: Record<string, any> = {
    Linea: LineChart,
    Barra: BarChart3,
    Gauge: Gauge,
    Indicador: Activity,
    Torta: PieChart,
};

export default function GraficosTab({ user, isActive = true }: { user: any; isActive?: boolean }) {
    const [graficos, setGraficos] = useState<any[]>([]);
    const [datasets, setDatasets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<any>(null);

    const fetchData = useCallback(async () => {
        try {
            const [grRes, dsRes] = await Promise.all([
                fetch('/api/okr-kpi/graficos'),
                fetch('/api/datasets?estado=Activo'),
            ]);
            if (grRes.ok) setGraficos(await grRes.json());
            if (dsRes.ok) setDatasets(await dsRes.json());
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { 
        if (isActive) fetchData(); 
    }, [fetchData, isActive]);

    const handleSave = async (data: any) => {
        const url = editing ? `/api/okr-kpi/graficos/${editing.id}` : '/api/okr-kpi/graficos';
        const method = editing ? 'PUT' : 'POST';
        try {
            const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
            if (res.ok) { setShowModal(false); setEditing(null); fetchData(); }
        } catch (err) { console.error(err); }
    };

    if (loading) return <div className="flex items-center justify-center py-20"><div className="w-10 h-10 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" /></div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Configuración de Gráficos</h2>
                    <p className="text-sm text-slate-400">Definí gráficos para asociar a OKRs y KPIs</p>
                </div>
                <button onClick={() => { setEditing(null); setShowModal(true); }} className="flex items-center gap-2 h-9 px-4 bg-violet-600 text-white rounded-lg font-bold text-sm hover:bg-violet-700 shadow-sm">
                    <Plus className="w-4 h-4" /> Nuevo Gráfico
                </button>
            </div>

            {graficos.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-12 text-center">
                    <BarChart3 className="w-12 h-12 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
                    <h3 className="text-lg font-bold text-slate-600 dark:text-slate-300 mb-1">Sin gráficos configurados</h3>
                    <p className="text-sm text-slate-400">Creá configuraciones de gráficos para visualizar datos</p>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {graficos.map((g: any) => {
                        const Icon = TIPO_ICONS[g.tipoGrafico] || BarChart3;
                        return (
                            <div key={g.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm hover:shadow-md transition-all p-4 group">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center">
                                            <Icon className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="text-[9px] font-black text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/30 px-1.5 py-0.5 rounded uppercase tracking-wider">{g.codigoGrafico}</span>
                                                {g.dataset && <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded uppercase tracking-wider flex items-center gap-0.5" title={g.dataset.nombre}><Database className="w-2.5 h-2.5" /> DS</span>}
                                            </div>
                                            <p className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-0.5">{g.nombre}</p>
                                        </div>
                                    </div>
                                    <button onClick={() => { setEditing(g); setShowModal(true); }} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                                    </button>
                                </div>
                                {g.descripcion && <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-3">{g.descripcion}</p>}
                                <div className="flex items-center justify-between text-xs">
                                    <span className="font-medium text-slate-500 dark:text-slate-400">{g.tipoGrafico}</span>
                                    <div className="flex flex-col gap-1 items-end">
                                        <div className="flex items-center gap-2 text-slate-400">
                                            {g.dataset && <span className="truncate max-w-[150px]" title={g.dataset.nombre}>{g.dataset.nombre}</span>}
                                            {!g.dataset && <span className="italic text-[10px]">Sin Dataset</span>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {showModal && (
                <GraficoFormModal
                    grafico={editing}
                    datasets={datasets}
                    onClose={() => { setShowModal(false); setEditing(null); }}
                    onSave={handleSave}
                />
            )}
        </div>
    );
}

function GraficoFormModal({ grafico, datasets, onClose, onSave }: { grafico: any; datasets: any[]; onClose: () => void; onSave: (data: any) => void }) {
    const [form, setForm] = useState({
        nombre: grafico?.nombre || '',
        descripcion: grafico?.descripcion || '',
        tipoGrafico: grafico?.tipoGrafico || 'Linea',
        datasetId: grafico?.datasetId || '',
        estado: grafico?.estado || 'Activo',
        configuracion: grafico?.configuracion || { ejeX: '', series: [] },
    });
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        await onSave({ ...form, datasetId: form.datasetId || null });
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200] flex items-center justify-center">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
                    <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{grafico ? 'Editar Gráfico' : 'Nuevo Gráfico'}</h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl"><X className="w-5 h-5 text-slate-400" /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Nombre *</label>
                        <input value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} required className="w-full h-10 px-3 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Tipo de Gráfico *</label>
                        <select value={form.tipoGrafico} onChange={e => setForm(p => ({ ...p, tipoGrafico: e.target.value }))} className="w-full h-10 px-3 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none">
                            <option value="Linea">📈 Línea</option>
                            <option value="Barra">📊 Barra</option>
                            <option value="Gauge">🎯 Gauge</option>
                            <option value="Indicador">📍 Indicador</option>
                            <option value="Torta">🥧 Torta</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Descripción</label>
                        <textarea value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} rows={2} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none resize-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Dataset Origen</label>
                        <select value={form.datasetId} onChange={e => setForm(p => ({ ...p, datasetId: e.target.value }))} className="w-full h-10 px-3 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none">
                            <option value="">Seleccionar Dataset...</option>
                            {datasets.map(ds => (
                                <option key={ds.id} value={ds.id}>{ds.codigoDataset} — {ds.nombre}</option>
                            ))}
                        </select>
                    </div>
                    {form.datasetId && (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Eje X (Categoría)</label>
                                <input value={form.configuracion.ejeX} onChange={e => setForm(p => ({ ...p, configuracion: { ...p.configuracion, ejeX: e.target.value } }))} placeholder="Ej: mes" className="w-full h-10 px-3 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Serie(s) Eje Y</label>
                                <input value={form.configuracion.series.join(', ')} onChange={e => setForm(p => ({ ...p, configuracion: { ...p.configuracion, series: e.target.value.split(',').map(s => s.trim()).filter(Boolean) } }))} placeholder="Ej: ventas, gastos" className="w-full h-10 px-3 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none" />
                            </div>
                        </div>
                    )}
                    {grafico && (
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Estado</label>
                            <select value={form.estado} onChange={e => setForm(p => ({ ...p, estado: e.target.value }))} className="w-full h-10 px-3 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none">
                                <option value="Activo">Activo</option>
                                <option value="Inactivo">Inactivo</option>
                            </select>
                        </div>
                    )}
                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={onClose} className="h-10 px-5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">Cancelar</button>
                        <button type="submit" disabled={saving || !form.nombre} className="h-10 px-6 bg-violet-600 text-white rounded-lg text-sm font-bold hover:bg-violet-700 disabled:opacity-50 shadow-sm">
                            {saving ? 'Guardando...' : grafico ? 'Actualizar' : 'Crear Gráfico'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
