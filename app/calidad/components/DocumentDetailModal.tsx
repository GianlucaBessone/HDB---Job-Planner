'use client';

import { useState, useEffect } from 'react';
import { X, FileText, CheckCircle2, ShieldAlert, Plus, Trash2, Save, FileBox, AlertCircle } from 'lucide-react';
import { safeApiRequest } from '@/lib/offline';

export default function DocumentDetailModal({ documentId, onClose }: { documentId: string, onClose: () => void }) {
    const [doc, setDoc] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<'info' | 'versiones' | 'reglas' | 'checklist'>('info');

    // Checklist template state
    const [checklistItems, setChecklistItems] = useState<{ descripcion: string, esObligatorio: boolean }[]>([]);

    useEffect(() => {
        loadDocument();
    }, [documentId]);

    const loadDocument = async () => {
        setLoading(true);
        try {
            const res = await safeApiRequest(`/api/documentos/${documentId}`);
            if (res.ok) {
                const data = await res.json();
                setDoc(data);

                // Load checklist from the latest version if available
                if (data.versions && data.versions.length > 0) {
                    const latest = data.versions[0];
                    if (latest.checklistTemplate) {
                        setChecklistItems(latest.checklistTemplate);
                    }
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const addRule = async (ruleData: any) => {
        try {
            const res = await safeApiRequest(`/api/documentos/${documentId}/reglas`, {
                method: 'POST',
                body: JSON.stringify(ruleData)
            });
            if (res.ok) {
                loadDocument();
            }
        } catch (e) {
            console.error(e);
        }
    };

    const deleteRule = async (ruleId: string) => {
        try {
            await safeApiRequest(`/api/documentos/${documentId}/reglas?ruleId=${ruleId}`, {
                method: 'DELETE'
            });
            loadDocument();
        } catch (e) {
            console.error(e);
        }
    };

    const saveChecklistTemplate = async () => {
        if (!doc.versions || doc.versions.length === 0) return alert('No hay versiones para actualizar');
        const latestVersion = doc.versions[0];
        
        try {
            const res = await safeApiRequest(`/api/documentos/${documentId}/versions/${latestVersion.id}`, {
                method: 'PUT',
                body: JSON.stringify({
                    checklistTemplate: checklistItems
                })
            });
            if (res.ok) {
                alert('Plantilla de checklist guardada con éxito');
            }
        } catch (e) {
            console.error(e);
            alert('Error al guardar checklist');
        }
    };

    if (loading) return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 flex flex-col items-center gap-4">
                <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-slate-500 font-medium">Cargando documento...</p>
            </div>
        </div>
    );

    if (!doc) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 sm:p-6">
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-start bg-slate-50 dark:bg-slate-900/50">
                    <div className="flex gap-4 items-start">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                            <FileText className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="flex gap-2 items-center mb-1">
                                <span className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded text-[10px] font-black uppercase font-mono tracking-widest">
                                    {doc.codigoDocumental}
                                </span>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${
                                    doc.estado === 'vigente' ? 'bg-emerald-100 text-emerald-700' :
                                    doc.estado === 'borrador' ? 'bg-amber-100 text-amber-700' :
                                    'bg-slate-100 text-slate-500'
                                }`}>
                                    {doc.estado}
                                </span>
                            </div>
                            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{doc.titulo}</h2>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 px-6 gap-6 pt-2">
                    {[
                        { id: 'info', label: 'Información General' },
                        { id: 'versiones', label: 'Historial y Versiones' },
                        { id: 'reglas', label: 'Matriz de Aplicabilidad (Reglas)' },
                        { id: 'checklist', label: 'Plantilla de Checklist' }
                    ].map(t => (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id as any)}
                            className={`py-3 text-sm font-bold border-b-2 transition-colors ${
                                tab === t.id 
                                    ? 'border-indigo-600 text-indigo-600' 
                                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-900/20">
                    {tab === 'info' && (
                        <div className="space-y-6 max-w-3xl">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Tipo de Documento</p>
                                    <p className="font-medium text-slate-700 dark:text-slate-200">{doc.tipoDocumento}</p>
                                </div>
                                <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Área / Sector</p>
                                    <p className="font-medium text-slate-700 dark:text-slate-200">{doc.area}</p>
                                </div>
                                <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Responsable</p>
                                    <p className="font-medium text-slate-700 dark:text-slate-200">{doc.responsableNombre || 'No asignado'}</p>
                                </div>
                                <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Nivel de Criticidad</p>
                                    <p className="font-medium text-slate-700 dark:text-slate-200">{doc.nivelCriticidad}</p>
                                </div>
                            </div>

                            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Requerimientos Operativos Obligatorios</p>
                                <div className="flex gap-4">
                                    {doc.requiereConfirmacionLectura && (
                                        <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-3 py-1.5 rounded-lg text-sm font-bold">
                                            <CheckCircle2 className="w-4 h-4" /> Requiere Confirmación de Lectura
                                        </div>
                                    )}
                                    {doc.requiereCapacitacion && (
                                        <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-3 py-1.5 rounded-lg text-sm font-bold">
                                            <ShieldAlert className="w-4 h-4" /> Requiere Capacitación
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {tab === 'reglas' && (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Reglas de Asignación Automática a OS</h3>
                                    <p className="text-sm text-slate-500">Define en qué Órdenes de Servicio este documento aparecerá obligatoriamente.</p>
                                </div>
                                <button 
                                    onClick={() => {
                                        addRule({
                                            tipoActividad: prompt('Tipo de actividad (ej. Mantenimiento, Instalación) o deja vacío para todas:'),
                                            bloqueanteDeInicio: confirm('¿Es un documento bloqueante? (Si/No)'),
                                            generaChecklist: confirm('¿Genera checklist dinámico? (Si/No)')
                                        });
                                    }}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-xl text-sm flex items-center gap-2 transition-colors"
                                >
                                    <Plus className="w-4 h-4" />
                                    Nueva Regla Rápida
                                </button>
                            </div>

                            {doc.applicabilityRules?.length === 0 ? (
                                <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 border-dashed">
                                    <ShieldAlert className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                                    <p className="font-bold text-slate-500">No hay reglas definidas.</p>
                                    <p className="text-sm text-slate-400">Este documento no se asignará automáticamente a ninguna OS por ahora.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {doc.applicabilityRules?.map((rule: any) => (
                                        <div key={rule.id} className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm relative group">
                                            <button 
                                                onClick={() => deleteRule(rule.id)}
                                                className="absolute top-4 right-4 p-1.5 bg-red-50 text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                            
                                            <div className="space-y-3">
                                                <div>
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Condición</p>
                                                    <p className="font-bold text-slate-700 dark:text-slate-200 text-sm mt-0.5">
                                                        {rule.tipoActividad ? `Solo para OS de tipo: ${rule.tipoActividad}` : 'Para cualquier tipo de OS'}
                                                    </p>
                                                </div>
                                                <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                                                    {rule.bloqueanteDeInicio && (
                                                        <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-1 rounded flex items-center gap-1">
                                                            <AlertCircle className="w-3 h-3" /> Bloqueante
                                                        </span>
                                                    )}
                                                    {rule.generaChecklist && (
                                                        <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-1 rounded flex items-center gap-1">
                                                            <CheckCircle2 className="w-3 h-3" /> Genera Checklist
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {tab === 'checklist' && (
                        <div className="space-y-6 max-w-3xl">
                            <div className="flex justify-between items-center bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-800">
                                <div>
                                    <h3 className="text-sm font-bold text-indigo-900 dark:text-indigo-100 flex items-center gap-2">
                                        <FileBox className="w-4 h-4" /> Plantilla de Checklist
                                    </h3>
                                    <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-1">
                                        Estos pasos se exigirán a los técnicos si la Regla de Asignación tiene "Genera Checklist" activado.
                                    </p>
                                </div>
                                <button
                                    onClick={saveChecklistTemplate}
                                    className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm hover:bg-indigo-700 transition-colors"
                                >
                                    <Save className="w-4 h-4" /> Guardar Plantilla
                                </button>
                            </div>

                            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm">
                                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                                    {checklistItems.map((item, idx) => (
                                        <div key={idx} className="p-4 flex gap-4 items-center group">
                                            <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0">
                                                {idx + 1}
                                            </div>
                                            <input
                                                type="text"
                                                value={item.descripcion}
                                                onChange={(e) => {
                                                    const n = [...checklistItems];
                                                    n[idx].descripcion = e.target.value;
                                                    setChecklistItems(n);
                                                }}
                                                className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-medium p-0"
                                                placeholder="Descripción de la tarea a verificar..."
                                            />
                                            <label className="flex items-center gap-2 text-xs font-bold text-slate-500 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={item.esObligatorio}
                                                    onChange={(e) => {
                                                        const n = [...checklistItems];
                                                        n[idx].esObligatorio = e.target.checked;
                                                        setChecklistItems(n);
                                                    }}
                                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
                                                />
                                                Obligatorio
                                            </label>
                                            <button
                                                onClick={() => setChecklistItems(checklistItems.filter((_, i) => i !== idx))}
                                                className="p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <div className="p-3 bg-slate-50 dark:bg-slate-900/50">
                                    <button
                                        onClick={() => setChecklistItems([...checklistItems, { descripcion: '', esObligatorio: true }])}
                                        className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1.5"
                                    >
                                        <Plus className="w-3.5 h-3.5" /> Agregar Paso al Checklist
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {tab === 'versiones' && (
                        <div className="space-y-4">
                            {doc.versions?.map((v: any) => (
                                <div key={v.id} className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
                                    <div className="flex justify-between">
                                        <div>
                                            <span className="font-bold text-lg text-slate-800 dark:text-slate-100">v{v.versionLabel}</span>
                                            <span className={`ml-3 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${
                                                v.estado === 'vigente' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                                            }`}>
                                                {v.estado}
                                            </span>
                                        </div>
                                        <span className="text-xs font-medium text-slate-400">
                                            {new Date(v.createdAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">{v.motivoCambio}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
