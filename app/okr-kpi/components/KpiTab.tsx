'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Activity, Edit2, X, TrendingUp, AlertTriangle, CheckCircle2, XCircle, Send } from 'lucide-react';
import ReactECharts from 'echarts-for-react';
import SemaforoIcon from './SemaforoIcon';

export default function KpiTab({ user, isActive = true }: { user: any; isActive?: boolean }) {
    const [kpis, setKpis] = useState<any[]>([]);
    const [okrs, setOkrs] = useState<any[]>([]);
    const [operators, setOperators] = useState<any[]>([]);
    const [datasets, setDatasets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncingId, setSyncingId] = useState<string | null>(null);
    const [showKpiModal, setShowKpiModal] = useState(false);
    const [editingKpi, setEditingKpi] = useState<any>(null);
    const [showMedicionModal, setShowMedicionModal] = useState<any>(null); // kpi object or null
    const [filterOkrId, setFilterOkrId] = useState('');

    const fetchData = useCallback(async () => {
        try {
            const [kpiRes, okrRes, opRes, dsRes] = await Promise.all([
                fetch('/api/okr-kpi/kpi'),
                fetch('/api/okr-kpi/okr'),
                fetch('/api/operators'),
                fetch('/api/datasets?estado=Activo'),
            ]);
            if (kpiRes.ok) setKpis(await kpiRes.json());
            if (okrRes.ok) setOkrs(await okrRes.json());
            if (opRes.ok) { const data = await opRes.json(); setOperators(data.filter((o: any) => o.activo)); }
            if (dsRes.ok) setDatasets(await dsRes.json());
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { 
        if (isActive) fetchData(); 
    }, [fetchData, isActive]);

    const handleSaveKpi = async (data: any) => {
        const url = editingKpi ? `/api/okr-kpi/kpi/${editingKpi.id}` : '/api/okr-kpi/kpi';
        const method = editingKpi ? 'PUT' : 'POST';
        try {
            const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
            if (res.ok) { setShowKpiModal(false); setEditingKpi(null); fetchData(); }
        } catch (err) { console.error(err); }
    };

    const handleSaveMedicion = async (kpiId: string, data: any) => {
        try {
            const res = await fetch(`/api/okr-kpi/kpi/${kpiId}/medicion`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
            if (res.ok) { setShowMedicionModal(null); fetchData(); }
        } catch (err) { console.error(err); }
    };

    const handleSyncKpi = async (kpiId: string) => {
        setSyncingId(kpiId);
        try {
            const res = await fetch(`/api/okr-kpi/kpi/${kpiId}/sincronizar`, { method: 'POST' });
            if (res.ok) { fetchData(); } else { 
                const err = await res.json();
                alert(`Error al sincronizar el indicador con el Dataset: ${err.error || 'Desconocido'}`); 
            }
        } catch (err) { console.error(err); } finally { setSyncingId(null); }
    };

    const filteredKpis = filterOkrId ? kpis.filter(k => k.okrId === filterOkrId) : kpis;

    if (loading) return <div className="flex items-center justify-center py-20"><div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Indicadores (KPI)</h2>
                    <p className="text-sm text-slate-400">Gestión de KPIs asociados a OKRs</p>
                </div>
                <div className="flex items-center gap-2">
                    <select value={filterOkrId} onChange={e => setFilterOkrId(e.target.value)} className="h-9 px-3 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                        <option value="">Todos los OKRs</option>
                        {okrs.map((o: any) => <option key={o.id} value={o.id}>{o.codigoOkr} — {o.nombre}</option>)}
                    </select>
                    <button onClick={() => { setEditingKpi(null); setShowKpiModal(true); }} className="flex items-center gap-2 h-9 px-4 bg-primary text-white rounded-lg font-bold text-sm hover:bg-primary/90 shadow-sm shrink-0">
                        <Plus className="w-4 h-4" /> Nuevo KPI
                    </button>
                </div>
            </div>

            {filteredKpis.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-12 text-center">
                    <Activity className="w-12 h-12 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
                    <h3 className="text-lg font-bold text-slate-600 dark:text-slate-300 mb-1">Sin KPIs</h3>
                    <p className="text-sm text-slate-400">Creá un KPI asociado a un OKR</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredKpis.map((kpi: any) => (
                        <div key={kpi.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm hover:shadow-md transition-all group">
                            <div className="flex flex-col md:flex-row items-start md:items-center gap-3 p-4">
                                <div className="shrink-0">
                                    <StatusIcon estado={kpi.estadoCumplimiento} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-[9px] font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded uppercase tracking-wider">{kpi.codigoKpi}</span>
                                        <span className="text-[9px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">{kpi.okr?.codigoOkr}</span>
                                        {kpi.estadoCumplimiento && (
                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                                kpi.estadoCumplimiento === 'Cumple' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                                kpi.estadoCumplimiento === 'En Riesgo' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                                'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                                            }`}>{kpi.estadoCumplimiento}</span>
                                        )}
                                    </div>
                                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-1 truncate">{kpi.nombre}</p>
                                    {kpi.responsableCarga && <p className="text-xs text-slate-400 mt-0.5">{kpi.responsableCarga.nombreCompleto}</p>}
                                </div>
                                <div className="flex items-center gap-4 shrink-0">
                                    <div className="text-center">
                                        <p className="text-xs text-slate-400 font-medium">Último</p>
                                        <p className="text-lg font-black text-slate-800 dark:text-slate-100">{kpi.ultimoValor ?? '—'}</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-xs text-slate-400 font-medium">Objetivo</p>
                                        <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{kpi.valorObjetivo}</p>
                                    </div>
                                    {kpi.unidadMedida && <span className="text-xs text-slate-400 font-medium">{kpi.unidadMedida}</span>}
                                </div>
                                <div className="hidden lg:block w-36 shrink-0">
                                    {kpi.historico && kpi.historico.length > 0 ? (
                                        <MiniChart historico={kpi.historico} objetivo={kpi.valorObjetivo} />
                                    ) : (
                                        <div className="text-xs text-slate-300 italic text-center">Sin datos</div>
                                    )}
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    {kpi.tipoRegistro === 'Dataset' ? (
                                        <button onClick={() => handleSyncKpi(kpi.id)} disabled={syncingId === kpi.id} className="flex items-center gap-1 h-8 px-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-all border border-indigo-100 dark:border-indigo-800 disabled:opacity-50">
                                            <Activity className={`w-3 h-3 ${syncingId === kpi.id ? 'animate-spin' : ''}`} /> {syncingId === kpi.id ? '...' : 'Sincronizar'}
                                        </button>
                                    ) : (
                                        <button onClick={() => setShowMedicionModal(kpi)} className="flex items-center gap-1 h-8 px-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-all border border-indigo-100 dark:border-indigo-800">
                                            <Send className="w-3 h-3" /> Medir
                                        </button>
                                    )}
                                    <button onClick={() => { setEditingKpi(kpi); setShowKpiModal(true); }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showKpiModal && <KpiFormModal kpi={editingKpi} okrs={okrs} operators={operators} datasets={datasets} onClose={() => { setShowKpiModal(false); setEditingKpi(null); }} onSave={handleSaveKpi} />}
            {showMedicionModal && <MedicionModal kpi={showMedicionModal} onClose={() => setShowMedicionModal(null)} onSave={(data: any) => handleSaveMedicion(showMedicionModal.id, data)} />}
        </div>
    );
}

function StatusIcon({ estado }: { estado: string | null }) {
    switch (estado) {
        case 'Cumple': return <CheckCircle2 className="w-6 h-6 text-emerald-500" />;
        case 'En Riesgo': return <AlertTriangle className="w-6 h-6 text-amber-500" />;
        case 'No Cumple': return <XCircle className="w-6 h-6 text-rose-500" />;
        default: return <Activity className="w-6 h-6 text-slate-300" />;
    }
}

function MiniChart({ historico, objetivo }: { historico: any[]; objetivo: number }) {
    const sorted = [...historico].sort((a, b) => new Date(a.fechaMedicion).getTime() - new Date(b.fechaMedicion).getTime());
    const option = {
        grid: { top: 4, right: 4, bottom: 4, left: 4 },
        xAxis: { type: 'category' as const, show: false, data: sorted.map((_, i) => i) },
        yAxis: { type: 'value' as const, show: false },
        series: [
            { type: 'line', data: sorted.map(h => h.valorObtenido), smooth: true, symbol: 'none', lineStyle: { width: 2, color: '#6366f1' }, areaStyle: { color: { type: 'linear' as const, x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(99,102,241,0.2)' }, { offset: 1, color: 'rgba(99,102,241,0.01)' }] } } },
            { type: 'line', data: sorted.map(() => objetivo), symbol: 'none', lineStyle: { width: 1, type: 'dashed' as const, color: '#10b981' } },
        ],
        tooltip: { show: false },
    };
    return <ReactECharts option={option} style={{ height: 40 }} opts={{ renderer: 'svg' }} />;
}

function KpiFormModal({ kpi, okrs, operators, datasets, onClose, onSave }: any) {
    const [form, setForm] = useState({
        okrId: kpi?.okrId || '',
        nombre: kpi?.nombre || '',
        descripcion: kpi?.descripcion || '',
        formulaCalculo: kpi?.formulaCalculo || '',
        unidadMedida: kpi?.unidadMedida || '',
        valorObjetivo: kpi?.valorObjetivo ?? '',
        valorMinimoAceptable: kpi?.valorMinimoAceptable ?? '',
        valorMaximoEsperado: kpi?.valorMaximoEsperado ?? '',
        frecuenciaMedicion: kpi?.frecuenciaMedicion || '',
        responsableCargaId: kpi?.responsableCargaId || '',
        fuenteDatos: kpi?.fuenteDatos || '',
        estado: kpi?.estado || 'Activo',
        tipoRegistro: kpi?.tipoRegistro || 'Manual',
        datasetId: kpi?.datasetId || '',
        campoValor: kpi?.campoValor || '',
        funcionAgregacion: kpi?.funcionAgregacion || '',
    });
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        await onSave({ ...form, responsableCargaId: form.responsableCargaId || null, datasetId: form.datasetId || null });
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200] flex items-start justify-center pt-[5vh] overflow-y-auto">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in-95 duration-200 mb-8">
                <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
                    <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{kpi ? 'Editar KPI' : 'Nuevo KPI'}</h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl"><X className="w-5 h-5 text-slate-400" /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    {!kpi && (
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">OKR Asociado *</label>
                            <select value={form.okrId} onChange={e => setForm(p => ({ ...p, okrId: e.target.value }))} required className="w-full h-10 px-3 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none">
                                <option value="">Seleccionar OKR...</option>
                                {okrs.map((o: any) => <option key={o.id} value={o.id}>{o.codigoOkr} — {o.nombre}</option>)}
                            </select>
                        </div>
                    )}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Nombre *</label>
                        <input value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} required className="w-full h-10 px-3 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none" placeholder="Ej: Índice de satisfacción del cliente" />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Valor Objetivo *</label>
                            <input type="number" step="any" value={form.valorObjetivo} onChange={e => setForm(p => ({ ...p, valorObjetivo: e.target.value }))} required className="w-full h-10 px-3 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Mín. Aceptable</label>
                            <input type="number" step="any" value={form.valorMinimoAceptable} onChange={e => setForm(p => ({ ...p, valorMinimoAceptable: e.target.value }))} className="w-full h-10 px-3 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Máx. Esperado</label>
                            <input type="number" step="any" value={form.valorMaximoEsperado} onChange={e => setForm(p => ({ ...p, valorMaximoEsperado: e.target.value }))} className="w-full h-10 px-3 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Unidad de Medida</label>
                            <input value={form.unidadMedida} onChange={e => setForm(p => ({ ...p, unidadMedida: e.target.value }))} className="w-full h-10 px-3 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none" placeholder="Ej: %, puntos, horas" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Frecuencia Medición</label>
                            <select value={form.frecuenciaMedicion} onChange={e => setForm(p => ({ ...p, frecuenciaMedicion: e.target.value }))} className="w-full h-10 px-3 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none">
                                <option value="">Seleccionar...</option>
                                <option value="Diario">Diario</option>
                                <option value="Semanal">Semanal</option>
                                <option value="Mensual">Mensual</option>
                                <option value="Trimestral">Trimestral</option>
                                <option value="Semestral">Semestral</option>
                                <option value="Anual">Anual</option>
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Responsable Carga</label>
                            <select value={form.responsableCargaId} onChange={e => setForm(p => ({ ...p, responsableCargaId: e.target.value }))} className="w-full h-10 px-3 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none">
                                <option value="">Seleccionar...</option>
                                {operators.map((op: any) => <option key={op.id} value={op.id}>{op.nombreCompleto}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Fuente de Datos</label>
                            <input value={form.fuenteDatos} onChange={e => setForm(p => ({ ...p, fuenteDatos: e.target.value }))} className="w-full h-10 px-3 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none" placeholder="Ej: Sistema ERP, encuestas" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Fórmula de Cálculo</label>
                        <input value={form.formulaCalculo} onChange={e => setForm(p => ({ ...p, formulaCalculo: e.target.value }))} className="w-full h-10 px-3 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none" placeholder="Ej: (Clientes satisfechos / Total encuestas) x 100" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Tipo de Registro</label>
                            <select value={form.tipoRegistro} onChange={e => setForm(p => ({ ...p, tipoRegistro: e.target.value, datasetId: e.target.value === 'Manual' ? '' : p.datasetId }))} className="w-full h-10 px-3 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none">
                                <option value="Manual">Manual</option>
                                <option value="Dataset">Dataset (Automático)</option>
                            </select>
                        </div>
                    </div>
                    {form.tipoRegistro === 'Dataset' && (
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl space-y-4 border border-slate-200 dark:border-slate-700">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Dataset Origen *</label>
                                <select value={form.datasetId} onChange={e => setForm(p => ({ ...p, datasetId: e.target.value }))} required className="w-full h-10 px-3 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none">
                                    <option value="">Seleccionar Dataset...</option>
                                    {datasets.map((d: any) => <option key={d.id} value={d.id}>{d.codigoDataset} — {d.nombre}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Campo Valor *</label>
                                    <input value={form.campoValor} onChange={e => setForm(p => ({ ...p, campoValor: e.target.value }))} required className="w-full h-10 px-3 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none" placeholder="Ej: cantidad_ventas" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Agregación (Opcional)</label>
                                    <select value={form.funcionAgregacion} onChange={e => setForm(p => ({ ...p, funcionAgregacion: e.target.value }))} className="w-full h-10 px-3 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none">
                                        <option value="">Ninguna (Primer valor)</option>
                                        <option value="SUM">Suma (SUM)</option>
                                        <option value="AVG">Promedio (AVG)</option>
                                        <option value="COUNT">Conteo (COUNT)</option>
                                        <option value="MIN">Mínimo (MIN)</option>
                                        <option value="MAX">Máximo (MAX)</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}
                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={onClose} className="h-10 px-5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">Cancelar</button>
                        <button type="submit" disabled={saving || !form.nombre || !form.valorObjetivo || (!kpi && !form.okrId) || (form.tipoRegistro === 'Dataset' && (!form.datasetId || !form.campoValor))} className="h-10 px-6 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 disabled:opacity-50 shadow-sm">
                            {saving ? 'Guardando...' : kpi ? 'Actualizar' : 'Crear KPI'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function MedicionModal({ kpi, onClose, onSave }: { kpi: any; onClose: () => void; onSave: (data: any) => void }) {
    const [valor, setValor] = useState('');
    const [comentario, setComentario] = useState('');
    const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
    const [saving, setSaving] = useState(false);

    // Preview calculation
    const valorNum = parseFloat(valor);
    let previewEstado = '';
    if (!isNaN(valorNum) && kpi.valorObjetivo) {
        if (valorNum >= kpi.valorObjetivo) previewEstado = 'Cumple';
        else if (valorNum >= kpi.valorObjetivo * 0.9) previewEstado = 'En Riesgo';
        else previewEstado = 'No Cumple';
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        await onSave({ valorObtenido: valor, comentario, fechaMedicion: fecha });
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200] flex items-center justify-center">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Registrar Medición</h2>
                        <p className="text-xs text-slate-400 mt-0.5">{kpi.codigoKpi} — {kpi.nombre}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl"><X className="w-5 h-5 text-slate-400" /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3 flex items-center justify-between text-sm">
                        <span className="text-slate-500 font-medium">Objetivo:</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">{kpi.valorObjetivo} {kpi.unidadMedida || ''}</span>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Fecha Medición</label>
                        <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="w-full h-10 px-3 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Valor Obtenido *</label>
                        <input type="number" step="any" value={valor} onChange={e => setValor(e.target.value)} required className="w-full h-12 px-3 border border-slate-200 dark:border-slate-600 rounded-lg text-lg font-bold bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" placeholder="0" autoFocus />
                    </div>
                    {previewEstado && (
                        <div className={`rounded-xl p-3 flex items-center justify-center gap-2 text-sm font-bold ${
                            previewEstado === 'Cumple' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                            previewEstado === 'En Riesgo' ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                            'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                        }`}>
                            <SemaforoIcon estado={previewEstado} size="sm" />
                            {previewEstado}
                            <span className="font-normal ml-1">({Math.round((valorNum / kpi.valorObjetivo) * 100)}%)</span>
                        </div>
                    )}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Comentario</label>
                        <textarea value={comentario} onChange={e => setComentario(e.target.value)} rows={2} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none resize-none" />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={onClose} className="h-10 px-5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">Cancelar</button>
                        <button type="submit" disabled={saving || !valor} className="h-10 px-6 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 shadow-sm">
                            {saving ? 'Registrando...' : 'Registrar Medición'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
