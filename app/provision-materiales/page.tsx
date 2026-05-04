'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
    Package, Plus, Trash2, Edit2, Check, X, ChevronDown, ChevronRight,
    AlertTriangle, CheckCircle2, Clock, RotateCcw, Loader2, MessageSquare,
    Bell, FileSpreadsheet, ShieldCheck, Upload, Download, FileUp, FileText, CheckCircle
} from 'lucide-react';
import CodeBadge from '@/components/CodeBadge';
import * as XLSX from 'xlsx';
import { createPortal } from 'react-dom';
import { showToast } from '@/components/Toast';
import { ViewConfig, isViewAllowed } from '@/lib/viewAccess';

// ─── Types ──────────────────────────────────────────────────────────────────────
type MaterialUso = {
    id: string;
    cantidadUtilizada: number;
    operadorNombre: string;
    ordenServicioId: string | null;
    createdAt: string;
};
type MaterialDevolucion = {
    id: string;
    cantidadADevolver: number;
    estado: string;
    comentario: string | null;
    confirmadoPor: string | null;
    fechaConfirm: string | null;
};
type Material = {
    id: string;
    nombre: string;
    codigo: string | null;
    unidad: string;
    cantidadSolicitada: number;
    cantidadDisponible: number;
    cantidadEntregada: number;
    estado: string;
    usos: MaterialUso[];
    devolucion: MaterialDevolucion | null;
};
type Proyecto = {
    id: string;
    nombre: string;
    codigoProyecto?: string;
    cliente: string | null;
    estado: string;
    client: { nombre: string } | null;
    responsableUser: { nombreCompleto: string } | null;
    materialesProyecto: Material[];
};

// ─── Estado badge ──────────────────────────────────────────────────────────────
const ESTADO_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
    material_cargado:      { label: 'Disponible',       color: 'bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700',    icon: Package },
    material_entregado:    { label: 'Entregado',        color: 'bg-blue-100 text-blue-700 border-blue-200',       icon: Package },
    uso_confirmado:        { label: 'Uso confirmado',   color: 'bg-violet-100 text-violet-700 border-violet-200', icon: Check },
    pendiente_devolucion:  { label: 'Pendiente',        color: 'bg-amber-100 text-amber-700 border-amber-200',    icon: Clock },
    cerrado_ok:            { label: 'Completo',         color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
    cerrado_con_reserva:   { label: 'Con observación',  color: 'bg-rose-100 text-rose-700 border-rose-200',       icon: AlertTriangle },
};

function EstadoBadge({ estado }: { estado: string }) {
    const cfg = ESTADO_CONFIG[estado] || { label: estado, color: 'bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700', icon: Package };
    const Icon = cfg.icon;
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${cfg.color}`}>
            <Icon className="w-3 h-3" />
            {cfg.label}
        </span>
    );
}

// ─── Inline editable qty cell ──────────────────────────────────────────────────
function QtyCell({ value, onSave, disabled }: { value: number; onSave: (v: number) => void; disabled?: boolean }) {
    const [editing, setEditing] = useState(false);
    const [val, setVal] = useState(String(value));
    if (disabled) return <span className="font-bold text-slate-700 dark:text-slate-200">{value}</span>;
    if (!editing) return (
        <button onClick={() => { setVal(String(value)); setEditing(true); }}
            className="font-bold text-slate-700 dark:text-slate-200 hover:text-primary hover:underline transition-colors text-center inline-block min-w-[20px]">
            {value}
        </button>
    );
    return (
        <div className="flex items-center justify-center gap-1">
            <input autoFocus type="number" min={0} value={val} onChange={e => setVal(e.target.value)}
                className="w-16 border border-primary rounded-lg px-1.5 py-0.5 text-sm font-bold outline-none text-center" />
            <div className="flex flex-col gap-0.5">
                <button onClick={() => { onSave(parseFloat(val) || 0); setEditing(false); }}
                    className="p-1 bg-primary text-white rounded-md"><Check className="w-3 h-3" /></button>
                <button onClick={() => setEditing(false)}
                    className="p-1 bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 rounded-md"><X className="w-3 h-3" /></button>
            </div>
        </div>
    );
}

// ─── Unidades predefinidas ─────────────────────────────────────────────────────
const UNIDADES = ['Unid.', 'Mts.', 'Lts.', 'Kg.', 'm²', 'm³', 'Hs.', 'Gl.', 'Rll.', 'Par'];

// ─── Add Material Form ─────────────────────────────────────────────────────────
function AddMaterialForm({ proyectoId, onAdded }: { proyectoId: string; onAdded: () => void }) {
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({ 
        nombre: '', 
        codigo: '', 
        unidad: 'Unid.', 
        cantidadSolicitada: '', 
        cantidadDisponible: '', 
        cantidadEntregada: '' 
    });

    // Autocomplete por código
    useEffect(() => {
        const timeout = setTimeout(async () => {
            if (form.codigo && form.codigo.length >= 2) {
                const res = await fetch(`/api/materiales-proyecto?codigo=${form.codigo}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.nombre) {
                        setForm(p => ({ 
                            ...p, 
                            nombre: data.nombre, 
                            unidad: data.unidad || p.unidad 
                        }));
                    }
                }
            }
        }, 500);
        return () => clearTimeout(timeout);
    }, [form.codigo]);

    const handleSubmit = async () => {
        if (!form.nombre) return;
        setSaving(true);
        await fetch('/api/materiales-proyecto', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ proyectoId, ...form }),
        });
        setSaving(false);
        setOpen(false);
        setForm({ nombre: '', codigo: '', unidad: 'Unid.', cantidadSolicitada: '', cantidadDisponible: '', cantidadEntregada: '' });
        onAdded();
    };

    const handleQty = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.replace(/[^0-9.]/g, '');
        setForm(p => ({ ...p, [field]: val }));
    };

    if (!open) return (
        <button onClick={() => setOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 active:scale-95 transition-all shadow-md shadow-primary/20">
            <Plus className="w-4 h-4" /> Agregar material
        </button>
    );

    const qtyClass = 'border border-slate-200 dark:border-slate-700 rounded-xl px-1.5 py-2 text-sm font-bold outline-none focus:border-primary text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none';

    return (
        <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-3 flex flex-wrap md:flex-nowrap items-center gap-2 relative">
            <input
                placeholder="Código"
                title="Código interno del material"
                value={form.codigo}
                onChange={e => setForm(p => ({ ...p, codigo: e.target.value.toUpperCase() }))}
                className="w-24 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-2 text-xs font-bold outline-none focus:border-primary uppercase"
            />
            <input
                autoFocus
                placeholder="Nombre del material *"
                value={form.nombre}
                onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
                className="flex-1 min-w-[150px] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-medium outline-none focus:border-primary"
            />
            <select
                value={form.unidad}
                onChange={e => setForm(p => ({ ...p, unidad: e.target.value }))}
                className="w-24 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-2 text-sm font-bold outline-none focus:border-primary bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer"
            >
                {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            
            <input type="text" inputMode="numeric" pattern="[0-9.]*" placeholder="Sol." title="Solicitada" value={form.cantidadSolicitada} onChange={handleQty('cantidadSolicitada')} className={`${qtyClass} w-16`} />
            <input type="text" inputMode="numeric" pattern="[0-9.]*" placeholder="Disp." title="Disponible" value={form.cantidadDisponible} onChange={handleQty('cantidadDisponible')} className={`${qtyClass} w-16`} />
            <input type="text" inputMode="numeric" pattern="[0-9.]*" placeholder="Entr." title="Entregada" value={form.cantidadEntregada} onChange={handleQty('cantidadEntregada')} className={`${qtyClass} w-16`} />
            
            <div className="flex gap-1 ml-auto shrink-0 border-l border-slate-200 dark:border-slate-700 pl-2">
                <button onClick={() => setOpen(false)} className="p-2 bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-xl hover:bg-slate-200 hover:text-slate-600 border border-slate-200 dark:border-slate-700 transition-colors shadow-sm">
                    <X className="w-4 h-4" />
                </button>
                <button onClick={handleSubmit} disabled={saving || !form.nombre} className="p-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-sm shadow-primary/20">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                </button>
            </div>
        </div>
    );
}

// ─── Devolucion Modal ──────────────────────────────────────────────────────────
function DevolucionModal({
    material, userName, onClose, onDone,
}: { material: Material; userName: string; onClose: () => void; onDone: () => void }) {
    const totalUsado = material.usos.reduce((a, u) => a + u.cantidadUtilizada, 0);
    const aDevolver = Math.max(0, material.cantidadEntregada - totalUsado);
    const [estado, setEstado] = useState<'cerrado_ok' | 'cerrado_con_reserva'>('cerrado_ok');
    const [comentario, setComentario] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const handleConfirm = async () => {
        if (estado === 'cerrado_con_reserva' && !comentario.trim()) {
            setError('El comentario es obligatorio al confirmar con reserva.');
            return;
        }
        setSaving(true);
        const res = await fetch('/api/materiales-proyecto/devolucion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ materialId: material.id, cantidadADevolver: aDevolver, estado, comentario, confirmadoPor: userName }),
        });
        setSaving(false);
        if (res.ok) { onDone(); onClose(); }
        else { const d = await res.json(); setError(d.error || 'Error al confirmar'); }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-5">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">Confirmar Recepción</h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl"><X className="w-5 h-5" /></button>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-4 space-y-2 text-sm">
                    <p className="font-bold text-slate-700 dark:text-slate-200">{material.nombre}</p>
                    <div className="grid grid-cols-3 gap-2 text-center mt-2">
                        {[['Entregado', material.cantidadEntregada, 'text-blue-600'], ['Utilizado', totalUsado, 'text-violet-600'], ['A devolver', aDevolver, 'text-amber-600']].map(([l, v, c]) => (
                            <div key={String(l)} className="bg-white dark:bg-slate-800 rounded-xl p-2 border border-slate-200 dark:border-slate-700">
                                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">{l}</p>
                                <p className={`text-xl font-black ${c}`}>{Number(v).toFixed(0)}</p>
                                <p className="text-[10px] text-slate-400 dark:text-slate-500">{material.unidad}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-2">
                    <p className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Tipo de recepción</p>
                    <div className="grid grid-cols-2 gap-2">
                        {(['cerrado_ok', 'cerrado_con_reserva'] as const).map(opt => (
                            <button key={opt} onClick={() => setEstado(opt)}
                                className={`px-3 py-3 rounded-2xl text-xs font-black border transition-all ${estado === opt
                                    ? opt === 'cerrado_ok' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-rose-500 text-white border-rose-500'
                                    : 'bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'}`}>
                                {opt === 'cerrado_ok' ? '✓ Recepción conforme' : '⚠ Con observación'}
                            </button>
                        ))}
                    </div>
                </div>

                {estado === 'cerrado_con_reserva' && (
                    <div className="space-y-1">
                        <label className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Comentario obligatorio</label>
                        <textarea rows={3} value={comentario} onChange={e => setComentario(e.target.value)} placeholder="Describir la observación o reserva..."
                            className="w-full border border-slate-200 dark:border-slate-700 focus:border-rose-400 rounded-xl px-3 py-2 text-sm outline-none resize-none" />
                    </div>
                )}

                {error && <p className="text-xs font-bold text-rose-500 bg-rose-50 rounded-xl px-3 py-2">{error}</p>}

                <button onClick={handleConfirm} disabled={saving}
                    className={`w-full py-3 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${estado === 'cerrado_ok' ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-rose-500 hover:bg-rose-600 text-white'} disabled:opacity-50`}>
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                    Confirmar Recepción
                </button>
            </div>
        </div>
    );
}

// ─── Edit Material Modal ───────────────────────────────────────────────────────
function EditMaterialModal({ material, onClose, onDone }: { material: Material; onClose: () => void; onDone: () => void }) {
    const [form, setForm] = useState({ nombre: material.nombre, unidad: material.unidad, codigo: material.codigo || '' });
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        await fetch(`/api/materiales-proyecto/${material.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form)
        });
        setSaving(false);
        onDone();
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl max-w-sm w-full p-6 space-y-5">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">Editar Material</h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl"><X className="w-5 h-5" /></button>
                </div>
                <div className="space-y-3">
                    <div>
                        <label className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Código</label>
                        <input value={form.codigo} onChange={e => setForm(p => ({ ...p, codigo: e.target.value.toUpperCase() }))} className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-primary mt-1 uppercase" placeholder="OPCIONAL" />
                    </div>
                    <div>
                        <label className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Nombre</label>
                        <input value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-medium outline-none focus:border-primary mt-1" />
                    </div>
                    <div>
                        <label className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Unidad</label>
                        <select value={form.unidad} onChange={e => setForm(p => ({ ...p, unidad: e.target.value }))} className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-primary mt-1 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                            {!UNIDADES.includes(form.unidad) && form.unidad && (
                                <option value={form.unidad}>{form.unidad}</option>
                            )}
                            {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                    </div>
                </div>
                <button onClick={handleSave} disabled={saving || !form.nombre} className="w-full py-3 bg-primary hover:bg-primary/90 text-white rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-all disabled:opacity-50">
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />} Guardar
                </button>
            </div>
        </div>
    );
}

// ─── Delete Material Modal ─────────────────────────────────────────────────────
function DeleteMaterialModal({ material, onClose, onConfirm }: { material: Material; onClose: () => void; onConfirm: () => void }) {
    const [deleting, setDeleting] = useState(false);

    const handleConfirm = async () => {
        setDeleting(true);
        await onConfirm();
        setDeleting(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl max-w-sm w-full p-6 space-y-5">
                <div className="flex flex-col items-center text-center space-y-3">
                    <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center mb-2">
                        <AlertTriangle className="w-6 h-6 text-rose-500" />
                    </div>
                    <h2 className="text-xl font-black text-slate-800 dark:text-slate-100">Eliminar material</h2>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                        ¿Estás seguro que deseas eliminar <span className="font-bold text-slate-700 dark:text-slate-200">{material.nombre}</span>? Esta acción no se puede deshacer.
                    </p>
                </div>
                <div className="flex gap-2">
                    <button onClick={onClose} disabled={deleting} className="flex-1 py-3 bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 text-slate-600 dark:text-slate-300 rounded-2xl font-black text-sm transition-colors">Cancelar</button>
                    <button onClick={handleConfirm} disabled={deleting} className="flex-1 py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50">
                        {deleting && <Loader2 className="w-4 h-4 animate-spin" />} Eliminar
                    </button>
                </div>
            </div>
        </div>
    );
}

function SuccessNotificationModal({ onClose }: { onClose: () => void }) {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden p-8 flex flex-col items-center text-center animate-in zoom-in-95 duration-300">
                <div className="w-20 h-20 bg-emerald-100 rounded-3xl flex items-center justify-center mb-6 shadow-lg shadow-emerald-100/50">
                    <ShieldCheck className="w-10 h-10 text-emerald-600" />
                </div>
                <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight mb-2">Notificación Enviada</h3>
                <p className="text-slate-500 dark:text-slate-400 font-medium mb-8 leading-relaxed">
                    Los supervisores y responsables han sido notificados sobre los faltantes de materiales.
                </p>
                <button 
                    onClick={onClose}
                    className="w-full py-4 bg-primary text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95"
                >
                    Entendido
                </button>
            </div>
        </div>
    );
}

// ─── Import Modal ─────────────────────────────────────────────────────────────
function ImportModal({ onClose, onDone }: { onClose: () => void; onDone: (results: any) => void }) {
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState<'reemplazar' | 'sumar'>('reemplazar');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) setFile(e.target.files[0]);
    };

    const handleImport = async () => {
        if (!file) return;
        setLoading(true);
        try {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetsData: any[] = [];

                workbook.SheetNames.forEach(sheetName => {
                    const ws = workbook.Sheets[sheetName];
                    const json = XLSX.utils.sheet_to_json(ws);
                    sheetsData.push({
                        codigoProyecto: sheetName.trim(),
                        rows: json.map((row: any) => ({
                            nombre: row.nombre || row.Nombre || row.MATERIAL || row.material,
                            solicitado: row.solicitado || row.Solicitado || row.SOL || row.sol,
                            disponible: row.disponible || row.Disponible || row.DISP || row.disp,
                            entregado: row.entregado || row.Entregado || row.ENTR || row.entr
                        }))
                    });
                });

                const res = await fetch('/api/provision-materiales/importar', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sheets: sheetsData, mode })
                });

                const resultBody = await res.json();
                if (res.ok) {
                    onDone(resultBody.results);
                } else {
                    showToast(resultBody.error || 'Error al importar', 'error');
                }
                setLoading(false);
            };
            reader.readAsBinaryString(file);
        } catch (error) {
            console.error('Import error:', error);
            showToast('Error al procesar el archivo', 'error');
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-2xl max-w-md w-full p-8 space-y-6 animate-in zoom-in-95 duration-300">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-xl">
                            <FileUp className="w-6 h-6 text-primary" />
                        </div>
                        <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Importar Materiales</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-slate-400 dark:text-slate-500 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="space-y-4">
                    <div className="p-6 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl flex flex-col items-center justify-center gap-3 bg-slate-50/50 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors cursor-pointer relative group">
                        <input type="file" accept=".xlsx,.xls,.ods" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" />
                        <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                            <Upload className="w-6 h-6 text-slate-400 dark:text-slate-500" />
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{file ? file.name : 'Seleccionar archivo'}</p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-1">XLSX, XLS, ODS</p>
                        </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl space-y-3">
                        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Modo de importación</p>
                        <div className="grid grid-cols-2 gap-2">
                            {(['reemplazar', 'sumar'] as const).map(m => (
                                <button key={m} onClick={() => setMode(m)}
                                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border transition-all ${mode === m ? 'bg-white dark:bg-slate-800 text-primary border-primary shadow-sm' : 'bg-transparent text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'}`}>
                                    {m}
                                </button>
                            ))}
                        </div>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 italic">
                            {mode === 'reemplazar' ? '* Sobrescribe cantidades si el nombre coincide.' : '* Suma las cantidades a las actuales.'}
                        </p>
                    </div>
                </div>

                <div className="flex gap-3 pt-2">
                    <button onClick={onClose} className="flex-1 py-4 bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all">
                        Cancelar
                    </button>
                    <button onClick={handleImport} disabled={!file || loading}
                        className="flex-[2] py-4 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-50">
                        {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Realizar Importación'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function ImportResultModal({ results, onClose }: { results: any[]; onClose: () => void }) {
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-2xl max-w-lg w-full p-8 flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Resumen de Importación</h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-slate-400 dark:text-slate-500"><X className="w-5 h-5" /></button>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 space-y-3 scrollbar-thin">
                    {results.map((res, i) => (
                        <div key={i} className={`p-4 rounded-2xl border flex items-center justify-between ${res.ignored ? 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 opacity-60' : res.success ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
                            <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${res.ignored ? 'bg-slate-200 dark:bg-slate-700' : res.success ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                                    {res.ignored ? <X className="w-4 h-4 text-slate-500 dark:text-slate-400" /> : res.success ? <Check className="w-4 h-4 text-white" /> : <AlertTriangle className="w-4 h-4 text-white" />}
                                </div>
                                <div>
                                    <p className="text-sm font-black text-slate-800 dark:text-slate-100">{res.sheetName}</p>
                                    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">{res.message}</p>
                                </div>
                            </div>
                            {!res.ignored && (
                                <div className="text-right">
                                    <p className="text-xs font-black text-emerald-600">+{res.processedRows}</p>
                                    {res.ignoredRows > 0 && <p className="text-xs font-bold text-rose-500">⚠ {res.ignoredRows}</p>}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                <button onClick={onClose} className="w-full py-4 mt-6 bg-slate-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95">
                    Cerrar Resumen
                </button>
            </div>
        </div>
    );
}

// ─── Materials Table ───────────────────────────────────────────────────────────
function MaterialesTable({
    proyecto, user, onRefresh,
}: { proyecto: Proyecto; user: any; onRefresh: () => void }) {
    const [expanded, setExpanded] = useState(true);
    const [devolucionTarget, setDevolucionTarget] = useState<Material | null>(null);
    const [editTarget, setEditTarget] = useState<Material | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Material | null>(null);
    const userRole = user?.role?.toLowerCase()?.trim();
    const isVendedor = ['vendedor', 'supervisor', 'admin'].includes(userRole || '');
    const isAdmin = userRole === 'admin';

    const handleUpdate = async (id: string, field: string, value: number) => {
        const mat = proyecto.materialesProyecto.find(m => m.id === id);
        if (!mat) return;

        if (field === 'cantidadEntregada') {
            if (value > mat.cantidadDisponible) {
                showToast('Error: La cantidad entregada no puede ser mayor a la cantidad disponible.', 'error');
                return;
            }
            const totalUsado = mat.usos.reduce((a, u) => a + u.cantidadUtilizada, 0);
            if (value < totalUsado) {
                showToast(`Error: Ya se han utilizado ${totalUsado} unidades. La cantidad entregada no puede ser menor a lo utilizado.`, 'error');
                return;
            }
        }
        
        if (field === 'cantidadDisponible') {
            if (value < mat.cantidadEntregada) {
                showToast(`Error: Ya se han entregado ${mat.cantidadEntregada} unidades. La cantidad disponible no puede ser menor a lo ya entregado.`, 'error');
                return;
            }
        }

        await fetch(`/api/materiales-proyecto/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [field]: value }),
        });
        onRefresh();
    };

    const handleDelete = async (id: string) => {
        await fetch(`/api/materiales-proyecto/${id}`, { method: 'DELETE' });
        onRefresh();
    };

    const materiales = proyecto.materialesProyecto;
    const hayPendientes = materiales.some(m => m.estado === 'pendiente_devolucion');
    
    const faltantes = materiales.filter(m => m.cantidadSolicitada > m.cantidadDisponible).map(m => ({
        ...m,
        faltante: m.cantidadSolicitada - m.cantidadDisponible
    }));
    const hasFaltantes = faltantes.length > 0;
    const [notificando, setNotificando] = useState(false);
    const [notiStatus, setNotiStatus] = useState<null | 'success' | 'error'>(null);
    const [showSuccessModal, setShowSuccessModal] = useState(false);

    const handleNotificarFaltantes = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!hasFaltantes || notificando) return;
        setNotificando(true);
        try {
            const res = await fetch('/api/provision-materiales/notificar-faltantes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    proyectoId: proyecto.id,
                    faltantes: faltantes,
                    notificadorNombre: user?.nombreCompleto || user?.nombre || 'Usuario',
                    userName: user?.usuario || 'Desconocido'
                })
            });
            if (res.ok) {
                setNotiStatus('success');
                setShowSuccessModal(true);
            }
            else setNotiStatus('error');
            setTimeout(() => setNotiStatus(null), 3000);
        } catch {
            setNotiStatus('error');
            setTimeout(() => setNotiStatus(null), 3000);
        } finally {
            setNotificando(false);
        }
    };

    const handleExportarExcel = () => {
        if (!hasFaltantes) return;
        const data = faltantes.map(f => ({
            'Propiedad': proyecto.codigoProyecto || '-',
            'Proyecto': proyecto.nombre,
            'Código Material': (f as any).codigo || '-',
            'Material': f.nombre,
            'Unidad': f.unidad,
            'Cantidad Solicitada': f.cantidadSolicitada,
            'Cantidad Disponible': f.cantidadDisponible,
            'Cantidad Faltante': f.faltante
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Faltantes");
        const codName = proyecto.codigoProyecto ? `_${proyecto.codigoProyecto}` : '';
        XLSX.writeFile(wb, `Faltantes${codName}.xlsx`);
    };

    return (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden">
            {/* Header */}
            <div
                onClick={() => setExpanded(p => !p)}
                className="w-full flex items-center justify-between p-4 md:p-5 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors cursor-pointer"
            >
                <div className="flex items-center gap-3 text-left">
                    <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                        <Package className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-black text-slate-800 dark:text-slate-100 text-sm md:text-base">{proyecto.nombre}</h3>
                            {proyecto.codigoProyecto && (
                                <CodeBadge 
                                    code={proyecto.codigoProyecto} 
                                    variant="project" 
                                    size="sm" 
                                    showCopy={true} 
                                    className="cursor-pointer active:scale-95 transition-transform"
                                />
                            )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                            {proyecto.client?.nombre || proyecto.cliente || '—'} · {materiales.length} material{materiales.length !== 1 ? 'es' : ''}
                            {hayPendientes && <span className="ml-2 text-amber-600 font-black">⚠ Pendiente devolución</span>}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleNotificarFaltantes}
                        disabled={!hasFaltantes || notificando}
                        title={hasFaltantes ? "Notificar Faltantes" : "No hay faltantes"}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${hasFaltantes ? 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100 shadow-sm' : 'bg-slate-50 dark:bg-slate-900/50 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 opacity-70'} ${notificando ? 'opacity-50' : ''}`}
                    >
                        {notificando ? <Loader2 className="w-4 h-4 animate-spin" /> : notiStatus === 'success' ? <Check className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                        <span className="hidden sm:inline">{notiStatus === 'success' ? 'Enviada' : 'Notificar Faltantes'}</span>
                    </button>
                    {expanded ? <ChevronDown className="w-5 h-5 text-slate-400 dark:text-slate-500 shrink-0" /> : <ChevronRight className="w-5 h-5 text-slate-400 dark:text-slate-500 shrink-0" />}
                </div>
            </div>

            {expanded && (
                <div className="border-t border-slate-100 dark:border-slate-800 p-4 md:p-5 space-y-4">
                    {materiales.length > 0 ? (
                        <div className="overflow-x-auto -mx-1">
                            <table className="w-full text-sm min-w-[1000px] table-fixed">
                                <thead>
                                    <tr className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                                        <th className="text-left pb-3 pl-2 w-20">Cod.</th>
                                        <th className="text-left pb-3 pr-4">Material</th>
                                        <th className="text-center pb-3 w-24">Solicitada</th>
                                        <th className="text-center pb-3 w-24">Disponible</th>
                                        <th className="text-center pb-3 w-24">Entregada</th>
                                        <th className="text-center pb-3 w-24">Utilizada</th>
                                        <th className="text-center pb-3 w-28">A devolver</th>
                                        <th className="text-center pb-3 w-32">Estado</th>
                                        <th className="text-center pb-3 w-24">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                    {materiales.map(mat => {
                                        const totalUsado = mat.usos.reduce((a, u) => a + u.cantidadUtilizada, 0);
                                        const aDevolver = mat.devolucion?.cantidadADevolver ?? Math.max(0, mat.cantidadEntregada - totalUsado);
                                        const closed = ['cerrado_ok', 'cerrado_con_reserva'].includes(mat.estado);
                                        return (
                                            <tr key={mat.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                                <td className="py-3 pl-2 truncate">
                                                    <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500">{mat.codigo || '—'}</span>
                                                </td>
                                                <td className="py-3 pr-4 break-words">
                                                    <span className="font-bold text-slate-700 dark:text-slate-200">{mat.nombre}</span>
                                                    <span className="ml-1.5 text-[10px] text-slate-400 dark:text-slate-500 font-medium uppercase whitespace-nowrap">{mat.unidad}</span>
                                                </td>
                                                <td className="text-center py-3">
                                                    <QtyCell value={mat.cantidadSolicitada} disabled={!isVendedor || closed}
                                                        onSave={v => handleUpdate(mat.id, 'cantidadSolicitada', v)} />
                                                </td>
                                                <td className="text-center py-3">
                                                    <QtyCell value={mat.cantidadDisponible} disabled={!isVendedor || closed}
                                                        onSave={v => handleUpdate(mat.id, 'cantidadDisponible', v)} />
                                                </td>
                                                <td className="text-center py-3">
                                                    <QtyCell value={mat.cantidadEntregada} disabled={!isVendedor || closed}
                                                        onSave={v => handleUpdate(mat.id, 'cantidadEntregada', v)} />
                                                </td>
                                                <td className="text-center py-3 font-bold text-violet-600">{totalUsado}</td>
                                                <td className="text-center py-3 font-bold text-amber-600">{aDevolver}</td>
                                                <td className="text-center py-3"><EstadoBadge estado={mat.estado} /></td>
                                                <td className="text-center py-3">
                                                    <div className="flex items-center justify-center gap-1">
                                                        {isVendedor && !closed && (
                                                            <button onClick={(e) => { e.stopPropagation(); setEditTarget(mat); }} title="Editar"
                                                                className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-lg transition-colors">
                                                                <Edit2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                        {isVendedor && mat.estado === 'pendiente_devolucion' && (
                                                            <button onClick={(e) => { e.stopPropagation(); setDevolucionTarget(mat); }} title="Confirmar recepción"
                                                                className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg transition-colors">
                                                                <RotateCcw className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                        {(() => {
                                                            const osBilledIds = (proyecto as any).ordenesServicio?.filter((os: any) => os.cobroGenerado || os.estado === 'cobrada' || os.estado === 'pagada').map((os: any) => os.id) || [];
                                                            const materialIsBilled = mat.usos.some(u => u.ordenServicioId && osBilledIds.includes(u.ordenServicioId));
                                                            const canDelete = !materialIsBilled && (!closed || isAdmin);
                                                            
                                                            return canDelete && (
                                                                <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(mat); }} title="Eliminar"
                                                                    className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-500 rounded-lg transition-colors">
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            );
                                                        })()}
                                                        {mat.devolucion?.comentario && (
                                                            <span title={mat.devolucion.comentario} className="p-1.5 text-slate-400 dark:text-slate-500">
                                                                <MessageSquare className="w-3.5 h-3.5" />
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center py-8 text-slate-400 dark:text-slate-500">
                            <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                            <p className="text-sm font-bold">Sin materiales cargados aún</p>
                        </div>
                    )}

                    <div className="flex items-center gap-2 flex-wrap">
                        {isVendedor && (
                            <AddMaterialForm proyectoId={proyecto.id} onAdded={onRefresh} />
                        )}
                        <button
                            onClick={handleExportarExcel}
                            disabled={!hasFaltantes}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all border ${hasFaltantes ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 shadow-sm' : 'bg-slate-50 dark:bg-slate-900/50 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 opacity-70 cursor-not-allowed'}`}
                            title={hasFaltantes ? "Exportar faltantes a Excel" : "No hay faltantes para exportar"}
                        >
                            <FileSpreadsheet className="w-4 h-4" /> Exportar faltantes
                        </button>
                    </div>
                </div>
            )}

            {devolucionTarget && (
                <DevolucionModal
                    material={devolucionTarget}
                    userName={user?.nombreCompleto || 'Vendedor'}
                    onClose={() => setDevolucionTarget(null)}
                    onDone={onRefresh}
                />
            )}

            {editTarget && (
                <EditMaterialModal
                    material={editTarget}
                    onClose={() => setEditTarget(null)}
                    onDone={onRefresh}
                />
            )}

            {deleteTarget && (
                <DeleteMaterialModal
                    material={deleteTarget}
                    onClose={() => setDeleteTarget(null)}
                    onConfirm={() => handleDelete(deleteTarget.id)}
                />
            )}

            {showSuccessModal && createPortal(
                <SuccessNotificationModal onClose={() => setShowSuccessModal(false)} />,
                document.body
            )}
        </div>
    );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function ProvisionMaterialesPage() {
    const [user, setUser] = useState<any>(null);
    const [proyectos, setProyectos] = useState<Proyecto[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'todos' | 'pendiente_devolucion' | 'cerrado'>('todos');
    const [showImport, setShowImport] = useState(false);
    const [importResults, setImportResults] = useState<any[] | null>(null);
    const [viewConfig, setViewConfig] = useState<ViewConfig[] | null>(null);

    useEffect(() => {
        const stored = localStorage.getItem('currentUser');
        if (stored) setUser(JSON.parse(stored));
        fetch('/api/config/views')
            .then(r => r.json())
            .then(data => { if (Array.isArray(data) && data.length > 0) setViewConfig(data); })
            .catch(() => {});
    }, []);

    const userRole = user?.role?.toLowerCase()?.trim() || '';
    const isAuthorized = !userRole || !viewConfig || isViewAllowed('/provision-materiales', userRole, 'sidebar', viewConfig);

    const loadData = useCallback(async (showLoader = false) => {
        if (showLoader) setLoading(true);
        const res = await fetch(`/api/provision-proyectos?t=${Date.now()}`, { cache: 'no-store' });
        const data = await res.json();
        setProyectos(Array.isArray(data) ? data : []);
        if (showLoader) setLoading(false);
    }, []);

    useEffect(() => { loadData(true); }, [loadData]);

    if (user && !isAuthorized) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-800 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 shadow-sm animate-in zoom-in-95 duration-300">
                <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mb-4">
                    <AlertTriangle className="w-8 h-8 text-rose-500" />
                </div>
                <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Acceso Denegado</h1>
                <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">Tu rol no tiene permisos para esta vista.</p>
                <Link href="/" className="mt-8 px-8 py-3 bg-primary text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all">
                    Volver al Inicio
                </Link>
            </div>
        );
    }

    const filteredProyectos = proyectos.filter(p => {
        if (filter === 'todos') return true;
        if (filter === 'pendiente_devolucion') return p.materialesProyecto.some(m => m.estado === 'pendiente_devolucion');
        if (filter === 'cerrado') return p.materialesProyecto.every(m => ['cerrado_ok', 'cerrado_con_reserva'].includes(m.estado));
        return true;
    });

    const handleDownloadTemplate = () => {
        const data = [
            { codigo: 'E-001', nombre: 'CABLE UTP CAT6', solicitado: 500, disponible: 300, entregado: 100 },
            { codigo: 'E-002', nombre: 'CANALETA 20X10', solicitado: 50, disponible: 50, entregado: 50 },
            { codigo: 'E-003', nombre: 'CONECTORES RJ45', solicitado: 100, disponible: 100, entregado: 80 },
        ];
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "PR-XXXX"); // Sample name
        XLSX.writeFile(wb, "HDB_Plantilla_Materiales.xlsx");
    };

    const stats = {
        total: proyectos.length,
        pendientes: proyectos.filter(p => p.materialesProyecto.some(m => m.estado === 'pendiente_devolucion')).length,
        cerrados: proyectos.filter(p => p.materialesProyecto.length > 0 && p.materialesProyecto.every(m => ['cerrado_ok', 'cerrado_con_reserva'].includes(m.estado))).length,
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 md:gap-6 justify-between">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary rounded-2xl shadow-lg shadow-primary/20 shrink-0">
                        <Package className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl md:text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight leading-tight">Provisión de Materiales</h1>
                        <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">Gestión de entrega y devolución de materiales por proyecto</p>
                    </div>
                </div>
                {isAuthorized && (
                    <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                        <button onClick={handleDownloadTemplate} className="hidden sm:flex items-center justify-center gap-2 px-4 py-3 sm:py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl text-[10px] md:text-xs font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all shadow-sm">
                            <Download className="w-4 h-4" /> Plantilla
                        </button>
                        <button onClick={() => setShowImport(true)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 sm:py-2.5 bg-slate-900 text-white rounded-2xl text-[10px] md:text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 active:scale-95">
                            <FileUp className="w-4 h-4 md:w-4 md:h-4" /> Importar Excel
                        </button>
                    </div>
                )}
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3 md:gap-4">
                {[
                    { label: 'Proy. Activos', value: stats.total, color: 'bg-primary/10 text-primary' },
                    { label: 'Pendientes', value: stats.pendientes, color: 'bg-amber-100 text-amber-700' },
                    { label: 'Cerrados', value: stats.cerrados, color: 'bg-emerald-100 text-emerald-700' },
                ].map(k => (
                    <div key={k.label} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-2 sm:p-4 shadow-sm text-center flex flex-col justify-center">
                        <div className={`text-xl md:text-2xl font-black ${k.color.split(' ')[1]}`}>{k.value}</div>
                        <div className="text-[9px] sm:text-[10px] sm:font-black font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider md:tracking-widest mt-0.5 md:mt-1 leading-tight break-words">{k.label}</div>
                    </div>
                ))}
            </div>

            {/* Filter tabs */}
            <div className="flex gap-2 bg-slate-100 dark:bg-slate-800/50 p-1 rounded-2xl w-fit">
                {([
                    { key: 'todos', label: 'Todos' },
                    { key: 'pendiente_devolucion', label: '⚠ Pendiente devolución' },
                    { key: 'cerrado', label: '✓ Cerrados' },
                ] as const).map(t => (
                    <button key={t.key} onClick={() => setFilter(t.key)}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${filter === t.key ? 'bg-white dark:bg-slate-800 text-primary shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            ) : filteredProyectos.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-16 text-center shadow-sm">
                    <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p className="text-base font-black text-slate-500 dark:text-slate-400">Sin proyectos en este estado</p>
                    <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                        {filter === 'todos'
                            ? 'Activá "Aprovisionamiento de Materiales" en un proyecto para que aparezca aquí.'
                            : 'No hay proyectos que coincidan con el filtro seleccionado.'}
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredProyectos.map(p => (
                        <MaterialesTable key={p.id} proyecto={p} user={user} onRefresh={loadData} />
                    ))}
                </div>
            )}

            {showImport && (
                <ImportModal
                    onClose={() => setShowImport(false)}
                    onDone={(res) => {
                        setShowImport(false);
                        setImportResults(res);
                        loadData();
                    }}
                />
            )}

            {importResults && (
                <ImportResultModal
                    results={importResults}
                    onClose={() => setImportResults(null)}
                />
            )}
        </div>
    );
}
