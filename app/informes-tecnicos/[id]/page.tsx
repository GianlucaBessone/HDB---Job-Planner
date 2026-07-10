'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Save, CheckCircle2, FileSignature, ArrowLeft, Loader2, Building2, User, Clock, Package, Plus, Trash2, Cloud, CloudOff, CloudLightning, X } from 'lucide-react';
import Link from 'next/link';
import { safeApiRequest } from '@/lib/offline';
import { showToast } from '@/components/Toast';
import SignatureButton from '@/components/SignatureButton';

export default function InformeFormPage({ params }: { params: { id: string } }) {
    const router = useRouter();
    const [informe, setInforme] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('saved');
    
    // Selectable options
    const [projects, setProjects] = useState<any[]>([]);
    const [clients, setClients] = useState<any[]>([]);
    const [operators, setOperators] = useState<any[]>([]);

    // Form state
    const [formData, setFormData] = useState<any>({});
    const [headerData, setHeaderData] = useState({
        projectId: '', clientId: '', planta: '', sector: '', equipo: '', activo: '',
        responsableId: '', empresaEjecutora: 'HDB', startTime: '', endTime: ''
    });
    const [personnel, setPersonnel] = useState<any[]>([]);

    // Delete Modal State
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteJustificacion, setDeleteJustificacion] = useState('');
    const [deleteDni, setDeleteDni] = useState('');

    const initialLoadDone = useRef(false);



    useEffect(() => {
        loadData();
    }, [params.id]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [infRes, projRes, cliRes, opRes] = await Promise.all([
                safeApiRequest(`/api/informes-tecnicos/${params.id}`),
                safeApiRequest('/api/projects'),
                safeApiRequest('/api/clients'),
                safeApiRequest('/api/operators')
            ]);
            
            if (infRes.ok) {
                const inf = await infRes.json();
                setInforme(inf);
                setFormData(inf.data || {});
                setHeaderData({
                    projectId: inf.projectId || '',
                    clientId: inf.clientId || '',
                    planta: inf.planta || '',
                    sector: inf.sector || '',
                    equipo: inf.equipo || '',
                    activo: inf.activo || '',
                    responsableId: inf.responsableId || '',
                    empresaEjecutora: inf.empresaEjecutora || 'HDB',
                    startTime: inf.startTime || '',
                    endTime: inf.endTime || ''
                });
                setPersonnel(inf.personnel || []);
                initialLoadDone.current = true;
            }
            if (projRes.ok) setProjects(await projRes.json());
            if (cliRes.ok) setClients(await cliRes.json());
            if (opRes.ok) setOperators(await opRes.json());
        } catch {
            showToast('Error al cargar informe', 'error');
        } finally {
            setLoading(false);
        }
    };

    // Auto-save logic
    useEffect(() => {
        if (!initialLoadDone.current || informe?.status === 'finalizado') return;

        setAutoSaveStatus('idle'); // Indicates changes are pending save
        const timer = setTimeout(() => {
            handleAutoSave();
        }, 1500);

        return () => clearTimeout(timer);
    }, [formData, headerData, personnel]);

    const handleAutoSave = async () => {
        setAutoSaveStatus('saving');
        try {
            const res = await fetch(`/api/informes-tecnicos/${params.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...headerData,
                    data: formData,
                    personnel,
                    status: informe?.status
                })
            });
            if (!res.ok) throw new Error();
            setAutoSaveStatus('saved');
        } catch {
            setAutoSaveStatus('error');
        }
    };

    const handleFinalize = async () => {
        if (!informe?.signature) {
            showToast('Debes firmar electrónicamente antes de finalizar', 'error');
            return;
        }

        setSaving(true);
        try {
            const res = await fetch(`/api/informes-tecnicos/${params.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'finalizado' })
            });
            if (!res.ok) throw new Error();
            const updated = await res.json();
            setInforme(updated);
            showToast('Informe finalizado con éxito', 'success');
        } catch {
            showToast('Error al finalizar el informe', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleSign = async (signatureAudit: any) => {
        try {
            const res = await fetch(`/api/informes-tecnicos/${params.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ signatureId: signatureAudit.SignatureID })
            });
            if (!res.ok) throw new Error();
            showToast('Informe firmado con éxito', 'success');
            loadData();
        } catch {
            showToast('Error al asociar la firma', 'error');
        }
    };

    const handleDelete = async (signatureAudit?: any) => {
        try {
            const isFinalizado = informe?.status === 'finalizado';
            const bodyPayload: any = {};
            
            if (isFinalizado) {
                if (!signatureAudit || !deleteJustificacion || !deleteDni) {
                    showToast('Faltan datos para eliminar el informe finalizado', 'error');
                    return;
                }
                bodyPayload.signatureId = signatureAudit.SignatureID;
                bodyPayload.justificacion = deleteJustificacion;
                bodyPayload.dni = deleteDni;
            }

            const res = await fetch(`/api/informes-tecnicos/${params.id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: Object.keys(bodyPayload).length > 0 ? JSON.stringify(bodyPayload) : undefined
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Error al eliminar');
            }
            showToast('Informe eliminado', 'success');
            router.push('/informes-tecnicos');
        } catch (e: any) {
            showToast(e.message, 'error');
        }
    };

    const handleFieldChange = (fieldId: string, value: any) => {
        setFormData((prev: any) => ({ ...prev, [fieldId]: value }));
    };

    const handleTableChange = (fieldId: string, rowIndex: number, columnId: string, value: any) => {
        setFormData((prev: any) => {
            const tableData = [...(prev[fieldId] || [])];
            if (!tableData[rowIndex]) tableData[rowIndex] = {};
            tableData[rowIndex][columnId] = value;
            return { ...prev, [fieldId]: tableData };
        });
    };

    const addTableRow = (fieldId: string) => {
        setFormData((prev: any) => ({
            ...prev,
            [fieldId]: [...(prev[fieldId] || []), {}]
        }));
    };

    const removeTableRow = (fieldId: string, rowIndex: number) => {
        setFormData((prev: any) => {
            const tableData = [...(prev[fieldId] || [])];
            tableData.splice(rowIndex, 1);
            return { ...prev, [fieldId]: tableData };
        });
    };

    const renderField = (field: any) => {
        const val = formData[field.id] || '';
        if (field.type === 'textarea') {
            return (
                <div key={field.id} className="space-y-1">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest">{field.label}</label>
                    <textarea 
                        disabled={informe.status === 'finalizado'}
                        className="w-full bg-background border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none min-h-[100px]"
                        value={val}
                        onChange={(e) => handleFieldChange(field.id, e.target.value)}
                        placeholder={field.label}
                    />
                </div>
            );
        }
        if (field.type === 'status-select') {
            return (
                <div key={field.id} className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 py-3">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{field.label}</span>
                    <select 
                        disabled={informe.status === 'finalizado'}
                        className="bg-card border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs font-bold outline-none"
                        value={val}
                        onChange={(e) => handleFieldChange(field.id, e.target.value)}
                    >
                        <option value="">Seleccionar...</option>
                        <option value="Correcto">Correcto</option>
                        <option value="Observado">Observado</option>
                        <option value="No aplica">No aplica</option>
                    </select>
                </div>
            );
        }
        if (field.type === 'table') {
            const tableRows = formData[field.id] || [];
            return (
                <div key={field.id} className="space-y-2 mt-4">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest">{field.label}</label>
                        {informe.status !== 'finalizado' && (
                            <button onClick={() => addTableRow(field.id)} className="text-xs font-bold text-primary flex items-center gap-1 bg-primary/10 px-2 py-1 rounded-lg">
                                <Plus className="w-3 h-3" /> Agregar fila
                            </button>
                        )}
                    </div>
                    <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-800/50 text-[10px] uppercase font-black text-slate-500 tracking-widest">
                                <tr>
                                    {field.columns.map((col: any) => (
                                        <th key={col.id} className="px-3 py-2 border-b border-slate-200 dark:border-slate-700">{col.label}</th>
                                    ))}
                                    {informe.status !== 'finalizado' && <th className="px-3 py-2 border-b border-slate-200 dark:border-slate-700"></th>}
                                </tr>
                            </thead>
                            <tbody>
                                {tableRows.map((row: any, rowIndex: number) => (
                                    <tr key={rowIndex} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                                        {field.columns.map((col: any) => (
                                            <td key={col.id} className="p-1">
                                                {col.type === 'select' ? (
                                                    <select 
                                                        disabled={informe.status === 'finalizado'}
                                                        className="w-full bg-transparent border-0 px-2 py-1.5 text-xs outline-none"
                                                        value={row[col.id] || ''}
                                                        onChange={(e) => handleTableChange(field.id, rowIndex, col.id, e.target.value)}
                                                    >
                                                        <option value="">-</option>
                                                        {col.options?.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                                                    </select>
                                                ) : (
                                                    <input 
                                                        disabled={informe.status === 'finalizado'}
                                                        type={col.type === 'number' ? 'number' : 'text'}
                                                        className="w-full bg-transparent border-0 px-2 py-1.5 text-xs outline-none"
                                                        value={row[col.id] || ''}
                                                        onChange={(e) => handleTableChange(field.id, rowIndex, col.id, e.target.value)}
                                                    />
                                                )}
                                            </td>
                                        ))}
                                        {informe.status !== 'finalizado' && (
                                            <td className="p-1 text-center">
                                                <button onClick={() => removeTableRow(field.id, rowIndex)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg">
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            );
        }
        
        return (
            <div key={field.id} className="space-y-1">
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest">{field.label}</label>
                <input 
                    disabled={informe.status === 'finalizado'}
                    type={field.type === 'number' ? 'number' : 'text'}
                    className="w-full bg-background border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                    value={val}
                    onChange={(e) => handleFieldChange(field.id, e.target.value)}
                    placeholder={field.label}
                />
            </div>
        );
    };

    if (loading) return (
        <div className="w-full max-w-4xl mx-auto flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
    );

    if (!informe) return (
        <div className="text-center py-20">Informe no encontrado.</div>
    );

    const isReadOnly = informe.status === 'finalizado';

    return (
        <>
        <div className="w-full max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6 pb-24">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <Link href="/informes-tecnicos" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-800 mb-2 transition-colors">
                        <ArrowLeft className="w-4 h-4" /> Volver
                    </Link>
                    <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                            informe.status === 'finalizado' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                            {informe.status === 'finalizado' ? '✓ Finalizado' : 'Borrador'}
                        </span>
                        {informe.signature && <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest">Firmado</span>}
                    </div>
                    <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight flex items-center gap-2">
                        <span className="text-primary font-mono">{informe.reportNumber}</span>
                        <span className="text-slate-300">|</span>
                        {informe.template?.name}
                    </h2>
                </div>
                <div className="flex items-center gap-2 text-sm font-bold">
                    {informe.status !== 'finalizado' && (
                        <>
                            {autoSaveStatus === 'saving' && <span className="text-slate-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</span>}
                            {autoSaveStatus === 'saved' && <span className="text-emerald-500 flex items-center gap-2"><Cloud className="w-4 h-4" /> Guardado</span>}
                            {autoSaveStatus === 'idle' && <span className="text-amber-500 flex items-center gap-2"><CloudLightning className="w-4 h-4" /> Cambios pendientes</span>}
                            {autoSaveStatus === 'error' && <span className="text-rose-500 flex items-center gap-2"><CloudOff className="w-4 h-4" /> Error al guardar</span>}
                        </>
                    )}
                </div>
            </div>

            {/* General Info */}
            <div className="bg-card border border-slate-200 dark:border-slate-700 rounded-2xl p-5 sm:p-6 space-y-4">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2">Información General</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Proyecto</label>
                        <select 
                            disabled={isReadOnly}
                            className="w-full bg-background border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                            value={headerData.projectId} onChange={e => {
                                const val = e.target.value;
                                const proj = projects.find(p => p.id === val);
                                setHeaderData({
                                    ...headerData, 
                                    projectId: val,
                                    clientId: proj?.clientId || headerData.clientId
                                });
                            }}
                        >
                            <option value="">Seleccionar...</option>
                            {projects.map(p => <option key={p.id} value={p.id}>{p.codigoProyecto ? p.codigoProyecto + ' | ' : ''}{p.nombre}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Cliente</label>
                        <select 
                            disabled={isReadOnly}
                            className="w-full bg-background border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                            value={headerData.clientId} onChange={e => setHeaderData({...headerData, clientId: e.target.value})}
                        >
                            <option value="">Seleccionar...</option>
                            {clients.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Responsable</label>
                        <select 
                            disabled={isReadOnly}
                            className="w-full bg-background border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                            value={headerData.responsableId} onChange={e => setHeaderData({...headerData, responsableId: e.target.value})}
                        >
                            <option value="">Seleccionar...</option>
                            {operators.map(o => <option key={o.id} value={o.id}>{o.nombreCompleto}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Planta</label>
                        <input disabled={isReadOnly} type="text" className="w-full bg-background border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm" value={headerData.planta} onChange={e => setHeaderData({...headerData, planta: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Sector</label>
                        <input disabled={isReadOnly} type="text" className="w-full bg-background border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm" value={headerData.sector} onChange={e => setHeaderData({...headerData, sector: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Equipo / Activo</label>
                        <input disabled={isReadOnly} type="text" className="w-full bg-background border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm" value={headerData.equipo} onChange={e => setHeaderData({...headerData, equipo: e.target.value})} />
                    </div>
                </div>
            </div>

            {/* Dynamic Sections */}
            {informe.template?.schema?.sections?.map((section: any) => (
                <div key={section.id} className="bg-card border border-slate-200 dark:border-slate-700 rounded-2xl p-5 sm:p-6 space-y-4">
                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2">{section.title}</h3>
                    <div className="grid grid-cols-1 gap-4">
                        {section.fields?.map((field: any) => renderField(field))}
                    </div>
                </div>
            ))}

        </div>

        {/* Action Bar (Bottom) */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 z-50">
            <div className="max-w-4xl mx-auto flex items-center justify-between">
                <div>
                    {informe.status !== 'finalizado' ? (
                        <button onClick={() => handleDelete()} className="px-4 py-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl font-bold text-sm flex items-center gap-2 transition-colors">
                            <Trash2 className="w-4 h-4" /> Eliminar Borrador
                        </button>
                    ) : (
                        <button onClick={() => setShowDeleteModal(true)} className="px-4 py-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl font-bold text-sm flex items-center gap-2 transition-colors">
                            <Trash2 className="w-4 h-4" /> Eliminar Informe (Admin)
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {informe.status === 'finalizado' && (
                        <a href={`/api/informes-tecnicos/${informe.id}/pdf`} target="_blank" className="px-4 py-2 bg-slate-800 text-white hover:bg-slate-700 rounded-xl font-bold text-sm flex items-center gap-2 transition-colors">
                            <FileText className="w-4 h-4" /> Descargar PDF
                        </a>
                    )}
                    {!isReadOnly && (
                        <>
                            {!informe.signature ? (
                                <SignatureButton 
                                    documentId={params.id} 
                                    documentVersion={informe.version?.toString() || '1'} 
                                    onSignComplete={handleSign}
                                    className="!px-4 !py-2 !rounded-xl !text-sm"
                                />
                            ) : (
                                <button disabled className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-xl font-bold text-sm flex items-center gap-2 cursor-not-allowed">
                                    <CheckCircle2 className="w-4 h-4" /> Documento Firmado
                                </button>
                            )}
                            <button 
                                onClick={handleFinalize} 
                                disabled={saving || !informe.signature} 
                                className="px-6 py-2 bg-primary text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-bold text-sm flex items-center gap-2 transition-colors"
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Finalizar
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>

        {/* Delete Modal for Finalizado */}
        {showDeleteModal && (
            <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
                    <div className="p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">Eliminar Informe Finalizado</h3>
                            <button onClick={() => setShowDeleteModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="bg-rose-50 dark:bg-rose-500/10 text-rose-600 p-3 rounded-xl text-sm font-medium">
                            Esta acción requiere permisos de administrador o supervisor. El informe será eliminado de forma permanente y se generará un registro de auditoría.
                        </div>
                        <div className="space-y-3">
                            <div className="space-y-1">
                                <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Justificación</label>
                                <textarea 
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-primary"
                                    placeholder="Motivo de la eliminación"
                                    value={deleteJustificacion}
                                    onChange={e => setDeleteJustificacion(e.target.value)}
                                    rows={3}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-black text-slate-500 uppercase tracking-widest">DNI del Administrador / Supervisor</label>
                                <input 
                                    type="text"
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-primary"
                                    placeholder="Ingresa tu DNI"
                                    value={deleteDni}
                                    onChange={e => setDeleteDni(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                        <button onClick={() => setShowDeleteModal(false)} className="px-4 py-2 text-sm font-bold text-slate-600 hover:text-slate-800">
                            Cancelar
                        </button>
                        <SignatureButton 
                            documentId={params.id} 
                            documentVersion={informe.version?.toString() || '1'} 
                            onSignComplete={handleDelete}
                            className="!bg-rose-500 hover:!bg-rose-600 !px-4 !py-2 !rounded-xl !text-sm"
                        />
                    </div>
                </div>
            </div>
        )}
        </>
    );
}
