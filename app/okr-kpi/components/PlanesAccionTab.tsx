'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Plus, ClipboardCheck, Edit2, X, Clock, CheckCircle2, AlertCircle } from 'lucide-react';

export default function PlanesAccionTab({ user, isActive = true }: { user: any; isActive?: boolean }) {
    const [planes, setPlanes] = useState<any[]>([]);
    const [operators, setOperators] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<any>(null);
    const [filterEstado, setFilterEstado] = useState('');

    const fetchData = useCallback(async () => {
        try {
            const [planRes, opRes] = await Promise.all([
                fetch('/api/okr-kpi/planes-accion'),
                fetch('/api/operators'),
            ]);
            if (planRes.ok) setPlanes(await planRes.json());
            if (opRes.ok) { const data = await opRes.json(); setOperators(data.filter((o: any) => o.activo)); }
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { 
        if (isActive) fetchData(); 
    }, [fetchData, isActive]);

    const handleSave = async (data: any) => {
        const url = editing ? `/api/okr-kpi/planes-accion/${editing.id}` : '/api/okr-kpi/planes-accion';
        const method = editing ? 'PUT' : 'POST';
        try {
            const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
            if (res.ok) { setShowModal(false); setEditing(null); fetchData(); }
        } catch (err) { console.error(err); }
    };

    const filtered = filterEstado ? planes.filter(p => p.estado === filterEstado) : planes;

    if (loading) return <div className="flex items-center justify-center py-20"><div className="w-10 h-10 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin" /></div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Planes de Acción</h2>
                    <p className="text-sm text-slate-400">Acciones correctivas para KPIs con incumplimientos</p>
                </div>
                <div className="flex items-center gap-2">
                    <select value={filterEstado} onChange={e => setFilterEstado(e.target.value)} className="h-9 px-3 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                        <option value="">Todos los estados</option>
                        <option value="Pendiente">Pendiente</option>
                        <option value="En Curso">En Curso</option>
                        <option value="Cerrado">Cerrado</option>
                    </select>
                </div>
            </div>

            {filtered.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-12 text-center">
                    <ClipboardCheck className="w-12 h-12 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
                    <h3 className="text-lg font-bold text-slate-600 dark:text-slate-300 mb-1">Sin planes de acción</h3>
                    <p className="text-sm text-slate-400">Los planes se crean desde KPIs en estado "No Cumple"</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map((plan: any) => (
                        <div key={plan.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm hover:shadow-md transition-all p-4 group">
                            <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
                                <div className="shrink-0">
                                    {plan.estado === 'Pendiente' && <Clock className="w-6 h-6 text-amber-500" />}
                                    {plan.estado === 'En Curso' && <AlertCircle className="w-6 h-6 text-blue-500" />}
                                    {plan.estado === 'Cerrado' && <CheckCircle2 className="w-6 h-6 text-emerald-500" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[9px] font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded uppercase tracking-wider">{plan.kpi?.codigoKpi}</span>
                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                            plan.estado === 'Pendiente' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                            plan.estado === 'En Curso' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                            'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                        }`}>{plan.estado}</span>
                                    </div>
                                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100 line-clamp-2">{plan.descripcion}</p>
                                    {plan.causa && <p className="text-xs text-slate-400 mt-1 line-clamp-1"><span className="font-semibold">Causa:</span> {plan.causa}</p>}
                                </div>
                                <div className="flex items-center gap-3 text-xs text-slate-400 shrink-0">
                                    {plan.responsable && <span>{plan.responsable.nombreCompleto}</span>}
                                    {plan.fechaCompromiso && <span>{new Date(plan.fechaCompromiso).toLocaleDateString('es-AR')}</span>}
                                </div>
                                <button onClick={() => { setEditing(plan); setShowModal(true); }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                    <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showModal && <PlanFormModal plan={editing} operators={operators} onClose={() => { setShowModal(false); setEditing(null); }} onSave={handleSave} />}
        </div>
    );
}

function PlanFormModal({ plan, operators, onClose, onSave }: any) {
    const [form, setForm] = useState({
        kpiId: plan?.kpiId || '',
        descripcion: plan?.descripcion || '',
        causa: plan?.causa || '',
        accionCorrectiva: plan?.accionCorrectiva || '',
        responsableId: plan?.responsableId || '',
        fechaCompromiso: plan?.fechaCompromiso ? new Date(plan.fechaCompromiso).toISOString().split('T')[0] : '',
        fechaCierre: plan?.fechaCierre ? new Date(plan.fechaCierre).toISOString().split('T')[0] : '',
        estado: plan?.estado || 'Pendiente',
    });
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        await onSave({ ...form, responsableId: form.responsableId || null, fechaCompromiso: form.fechaCompromiso || null, fechaCierre: form.fechaCierre || null });
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200] flex items-start justify-center pt-[10vh] overflow-y-auto">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg mx-4 border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in-95 duration-200 mb-8">
                <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
                    <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{plan ? 'Editar Plan de Acción' : 'Nuevo Plan'}</h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl"><X className="w-5 h-5 text-slate-400" /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Descripción *</label>
                        <textarea value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} rows={3} required className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none resize-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Causa del Incumplimiento</label>
                        <textarea value={form.causa} onChange={e => setForm(p => ({ ...p, causa: e.target.value }))} rows={2} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none resize-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Acción Correctiva</label>
                        <textarea value={form.accionCorrectiva} onChange={e => setForm(p => ({ ...p, accionCorrectiva: e.target.value }))} rows={2} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none resize-none" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Responsable</label>
                            <select value={form.responsableId} onChange={e => setForm(p => ({ ...p, responsableId: e.target.value }))} className="w-full h-10 px-3 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none">
                                <option value="">Seleccionar...</option>
                                {operators.map((op: any) => <option key={op.id} value={op.id}>{op.nombreCompleto}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Estado</label>
                            <select value={form.estado} onChange={e => setForm(p => ({ ...p, estado: e.target.value }))} className="w-full h-10 px-3 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none">
                                <option value="Pendiente">Pendiente</option>
                                <option value="En Curso">En Curso</option>
                                <option value="Cerrado">Cerrado</option>
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Fecha Compromiso</label>
                            <input type="date" value={form.fechaCompromiso} onChange={e => setForm(p => ({ ...p, fechaCompromiso: e.target.value }))} className="w-full h-10 px-3 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Fecha Cierre</label>
                            <input type="date" value={form.fechaCierre} onChange={e => setForm(p => ({ ...p, fechaCierre: e.target.value }))} className="w-full h-10 px-3 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none" />
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={onClose} className="h-10 px-5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">Cancelar</button>
                        <button type="submit" disabled={saving || !form.descripcion} className="h-10 px-6 bg-orange-600 text-white rounded-lg text-sm font-bold hover:bg-orange-700 disabled:opacity-50 shadow-sm">
                            {saving ? 'Guardando...' : plan ? 'Actualizar' : 'Crear Plan'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
