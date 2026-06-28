'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Target, Users, Calendar, Edit2, ChevronRight, BarChart3, X } from 'lucide-react';
import SemaforoIcon from './SemaforoIcon';

export default function OkrTab({ user, isActive = true, onNavigateToKpi }: { user: any; isActive?: boolean; onNavigateToKpi?: () => void }) {
    const [okrs, setOkrs] = useState<any[]>([]);
    const [operators, setOperators] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingOkr, setEditingOkr] = useState<any>(null);

    const fetchOkrs = useCallback(async () => {
        try {
            const res = await fetch('/api/okr-kpi/okr');
            if (res.ok) setOkrs(await res.json());
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    }, []);

    const fetchOperators = useCallback(async () => {
        try {
            const res = await fetch('/api/operators');
            if (res.ok) {
                const data = await res.json();
                setOperators(data.filter((o: any) => o.activo));
            }
        } catch (err) { console.error(err); }
    }, []);

    useEffect(() => { 
        if (isActive) {
            fetchOkrs(); 
            fetchOperators(); 
        }
    }, [fetchOkrs, fetchOperators, isActive]);

    const handleSave = async (data: any) => {
        const url = editingOkr ? `/api/okr-kpi/okr/${editingOkr.id}` : '/api/okr-kpi/okr';
        const method = editingOkr ? 'PUT' : 'POST';
        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (res.ok) {
                setShowModal(false);
                setEditingOkr(null);
                fetchOkrs();
            }
        } catch (err) { console.error(err); }
    };

    if (loading) return <div className="flex items-center justify-center py-20"><div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" /></div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Objetivos Estratégicos (OKR)</h2>
                    <p className="text-sm text-slate-400">Gestión de OKRs alineados con ISO 9001:2015</p>
                </div>
                <button onClick={() => { setEditingOkr(null); setShowModal(true); }} className="flex items-center gap-2 h-9 px-4 bg-emerald-600 text-white rounded-lg font-bold text-sm hover:bg-emerald-700 transition-all shadow-sm">
                    <Plus className="w-4 h-4" /> Nuevo OKR
                </button>
            </div>

            {okrs.length === 0 ? (
                <div className="bg-card text-card-foreground border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-12 text-center">
                    <Target className="w-12 h-12 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
                    <h3 className="text-lg font-bold text-slate-600 dark:text-slate-300 mb-1">Sin OKRs</h3>
                    <p className="text-sm text-slate-400">Creá tu primer Objetivo Estratégico</p>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {okrs.map((okr: any) => (
                        <div key={okr.id} className="bg-card text-card-foreground border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm hover:shadow-md transition-all flex flex-col overflow-hidden group">
                            <div className="p-4 flex-1">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-md uppercase tracking-wider">{okr.codigoOkr}</span>
                                    <div className="flex items-center gap-1.5">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase ${
                                            okr.estado === 'Activo' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                            okr.estado === 'Cerrado' ? 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' :
                                            'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400'
                                        }`}>{okr.estado}</span>
                                        <button onClick={() => { setEditingOkr(okr); setShowModal(true); }} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                                        </button>
                                    </div>
                                </div>
                                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-1 flex items-center gap-2">
                                    <Target className="w-4 h-4 text-emerald-500 shrink-0" />
                                    <span className="truncate">{okr.nombre}</span>
                                </h3>
                                {okr.descripcion && <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-3">{okr.descripcion}</p>}
                                <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                                    {okr.responsable && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{okr.responsable.nombreCompleto}</span>}
                                    {okr.fechaInicio && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(okr.fechaInicio).toLocaleDateString('es-AR')}</span>}
                                    <span className="flex items-center gap-1"><BarChart3 className="w-3 h-3" />{okr.kpis?.length || 0} KPIs</span>
                                </div>
                            </div>
                            <div className="border-t border-slate-100 dark:border-slate-700 p-3 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/30">
                                <div className="flex items-center gap-2">
                                    <SemaforoIcon estado={okr.estadoCumplimiento} size="sm" />
                                    <div className="w-24 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full transition-all ${
                                            okr.porcentajeAvance >= 100 ? 'bg-emerald-500' :
                                            okr.porcentajeAvance >= 70 ? 'bg-amber-500' : 'bg-rose-500'
                                        }`} style={{ width: `${Math.min(okr.porcentajeAvance, 100)}%` }} />
                                    </div>
                                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{Math.round(okr.porcentajeAvance)}%</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showModal && (
                <OkrFormModal
                    okr={editingOkr}
                    operators={operators}
                    onClose={() => { setShowModal(false); setEditingOkr(null); }}
                    onSave={handleSave}
                />
            )}
        </div>
    );
}



function OkrFormModal({ okr, operators, onClose, onSave }: {
    okr: any;
    operators: any[];
    onClose: () => void;
    onSave: (data: any) => void;
}) {
    const [form, setForm] = useState({
        nombre: okr?.nombre || '',
        descripcion: okr?.descripcion || '',
        areaResponsable: okr?.areaResponsable || '',
        responsableId: okr?.responsableId || '',
        fechaInicio: okr?.fechaInicio ? new Date(okr.fechaInicio).toISOString().split('T')[0] : '',
        fechaFin: okr?.fechaFin ? new Date(okr.fechaFin).toISOString().split('T')[0] : '',
        frecuenciaRevision: okr?.frecuenciaRevision || '',
        metaGlobal: okr?.metaGlobal || '',
        estado: okr?.estado || 'Activo',
        observaciones: okr?.observaciones || '',
    });

    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        await onSave({
            ...form,
            responsableId: form.responsableId || null,
        });
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200] flex items-start justify-center pt-[5vh] overflow-y-auto">
            <div className="bg-card text-card-foreground rounded-2xl shadow-2xl w-full max-w-2xl mx-4 border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in-95 duration-200 mb-8">
                <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
                    <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{okr ? 'Editar OKR' : 'Nuevo OKR'}</h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl"><X className="w-5 h-5 text-slate-400" /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Nombre *</label>
                        <input value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} required className="w-full h-10 px-3 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none" placeholder="Ej: Mejorar la satisfacción del cliente" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Descripción</label>
                        <textarea value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} rows={3} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none resize-none" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Área Responsable</label>
                            <input value={form.areaResponsable} onChange={e => setForm(p => ({ ...p, areaResponsable: e.target.value }))} className="w-full h-10 px-3 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Responsable</label>
                            <select value={form.responsableId} onChange={e => setForm(p => ({ ...p, responsableId: e.target.value }))} className="w-full h-10 px-3 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none">
                                <option value="">Seleccionar...</option>
                                {operators.map(op => <option key={op.id} value={op.id}>{op.nombreCompleto}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Fecha Inicio</label>
                            <input type="date" value={form.fechaInicio} onChange={e => setForm(p => ({ ...p, fechaInicio: e.target.value }))} className="w-full h-10 px-3 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Fecha Fin</label>
                            <input type="date" value={form.fechaFin} onChange={e => setForm(p => ({ ...p, fechaFin: e.target.value }))} className="w-full h-10 px-3 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Frecuencia Revisión</label>
                            <select value={form.frecuenciaRevision} onChange={e => setForm(p => ({ ...p, frecuenciaRevision: e.target.value }))} className="w-full h-10 px-3 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none">
                                <option value="">Seleccionar...</option>
                                <option value="Mensual">Mensual</option>
                                <option value="Trimestral">Trimestral</option>
                                <option value="Semestral">Semestral</option>
                                <option value="Anual">Anual</option>
                            </select>
                        </div>
                        {okr && (
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Estado</label>
                                <select value={form.estado} onChange={e => setForm(p => ({ ...p, estado: e.target.value }))} className="w-full h-10 px-3 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none">
                                    <option value="Activo">Activo</option>
                                    <option value="Cerrado">Cerrado</option>
                                    <option value="Cancelado">Cancelado</option>
                                </select>
                            </div>
                        )}
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Meta Global</label>
                        <textarea value={form.metaGlobal} onChange={e => setForm(p => ({ ...p, metaGlobal: e.target.value }))} rows={2} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none resize-none" placeholder="Descripción de la meta global del OKR" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Observaciones</label>
                        <textarea value={form.observaciones} onChange={e => setForm(p => ({ ...p, observaciones: e.target.value }))} rows={2} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none resize-none" />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={onClose} className="h-10 px-5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">Cancelar</button>
                        <button type="submit" disabled={saving || !form.nombre} className="h-10 px-6 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 shadow-sm transition-all">
                            {saving ? 'Guardando...' : okr ? 'Actualizar' : 'Crear OKR'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
