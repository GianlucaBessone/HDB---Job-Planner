'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
    Package, Plus, Trash2, Edit2, Check, X, ChevronDown, ChevronRight,
    AlertTriangle, CheckCircle2, Clock, RotateCcw, Loader2, MessageSquare,
} from 'lucide-react';
import CodeBadge from '@/components/CodeBadge';

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
    material_cargado:      { label: 'Cargado',          color: 'bg-slate-100 text-slate-600 border-slate-200',    icon: Package },
    material_entregado:    { label: 'Entregado',        color: 'bg-blue-100 text-blue-700 border-blue-200',       icon: Package },
    uso_confirmado:        { label: 'Uso confirmado',   color: 'bg-violet-100 text-violet-700 border-violet-200', icon: Check },
    pendiente_devolucion:  { label: 'Pend. devolución', color: 'bg-amber-100 text-amber-700 border-amber-200',    icon: Clock },
    cerrado_ok:            { label: 'Cerrado OK',       color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
    cerrado_con_reserva:   { label: 'Con reserva',      color: 'bg-rose-100 text-rose-700 border-rose-200',       icon: AlertTriangle },
};

function EstadoBadge({ estado }: { estado: string }) {
    const cfg = ESTADO_CONFIG[estado] || { label: estado, color: 'bg-slate-100 text-slate-500 border-slate-200', icon: Package };
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
    if (disabled) return <span className="font-bold text-slate-700">{value}</span>;
    if (!editing) return (
        <button onClick={() => { setVal(String(value)); setEditing(true); }}
            className="font-bold text-slate-700 hover:text-primary hover:underline transition-colors">
            {value}
        </button>
    );
    return (
        <span className="flex items-center gap-1">
            <input autoFocus type="number" min={0} value={val} onChange={e => setVal(e.target.value)}
                className="w-16 border border-primary rounded-lg px-1.5 py-0.5 text-sm font-bold outline-none text-center" />
            <button onClick={() => { onSave(parseFloat(val) || 0); setEditing(false); }}
                className="p-1 bg-primary text-white rounded-md"><Check className="w-3 h-3" /></button>
            <button onClick={() => setEditing(false)}
                className="p-1 bg-slate-100 text-slate-500 rounded-md"><X className="w-3 h-3" /></button>
        </span>
    );
}

// ─── Unidades predefinidas ─────────────────────────────────────────────────────
const UNIDADES = ['Unid.', 'Mts.', 'Lts.', 'Kg.', 'm²', 'm³', 'Hs.', 'Gl.', 'Rll.', 'Par'];

// ─── Add Material Form ─────────────────────────────────────────────────────────
function AddMaterialForm({ proyectoId, onAdded }: { proyectoId: string; onAdded: () => void }) {
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({ nombre: '', unidad: 'Unid.', cantidadSolicitada: '', cantidadDisponible: '', cantidadEntregada: '' });

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
        setForm({ nombre: '', unidad: 'Unid.', cantidadSolicitada: '', cantidadDisponible: '', cantidadEntregada: '' });
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

    const qtyClass = 'border border-slate-200 rounded-xl px-1.5 py-2 text-sm font-bold outline-none focus:border-primary text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none';

    return (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex flex-wrap md:flex-nowrap items-center gap-2 relative">
            <input
                autoFocus
                placeholder="Nombre del material *"
                value={form.nombre}
                onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
                className="flex-1 min-w-[200px] border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium outline-none focus:border-primary"
            />
            <select
                value={form.unidad}
                onChange={e => setForm(p => ({ ...p, unidad: e.target.value }))}
                className="w-24 border border-slate-200 rounded-xl px-2 py-2 text-sm font-bold outline-none focus:border-primary bg-white text-slate-700 cursor-pointer"
            >
                {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            
            <input type="text" inputMode="numeric" pattern="[0-9.]*" placeholder="Sol." title="Solicitada" value={form.cantidadSolicitada} onChange={handleQty('cantidadSolicitada')} className={`${qtyClass} w-16`} />
            <input type="text" inputMode="numeric" pattern="[0-9.]*" placeholder="Disp." title="Disponible" value={form.cantidadDisponible} onChange={handleQty('cantidadDisponible')} className={`${qtyClass} w-16`} />
            <input type="text" inputMode="numeric" pattern="[0-9.]*" placeholder="Entr." title="Entregada" value={form.cantidadEntregada} onChange={handleQty('cantidadEntregada')} className={`${qtyClass} w-16`} />
            
            <div className="flex gap-1 ml-auto shrink-0 border-l border-slate-200 pl-2">
                <button onClick={() => setOpen(false)} className="p-2 bg-white text-slate-400 rounded-xl hover:bg-slate-200 hover:text-slate-600 border border-slate-200 transition-colors shadow-sm">
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
            <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-5">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-black text-slate-800">Confirmar Recepción</h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl"><X className="w-5 h-5" /></button>
                </div>

                <div className="bg-slate-50 rounded-2xl p-4 space-y-2 text-sm">
                    <p className="font-bold text-slate-700">{material.nombre}</p>
                    <div className="grid grid-cols-3 gap-2 text-center mt-2">
                        {[['Entregado', material.cantidadEntregada, 'text-blue-600'], ['Utilizado', totalUsado, 'text-violet-600'], ['A devolver', aDevolver, 'text-amber-600']].map(([l, v, c]) => (
                            <div key={String(l)} className="bg-white rounded-xl p-2 border border-slate-200">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{l}</p>
                                <p className={`text-xl font-black ${c}`}>{Number(v).toFixed(0)}</p>
                                <p className="text-[10px] text-slate-400">{material.unidad}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-2">
                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Tipo de confirmación</p>
                    <div className="grid grid-cols-2 gap-2">
                        {(['cerrado_ok', 'cerrado_con_reserva'] as const).map(opt => (
                            <button key={opt} onClick={() => setEstado(opt)}
                                className={`px-3 py-3 rounded-2xl text-xs font-black border transition-all ${estado === opt
                                    ? opt === 'cerrado_ok' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-rose-500 text-white border-rose-500'
                                    : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                                {opt === 'cerrado_ok' ? '✓ Sin reserva' : '⚠ Con reserva'}
                            </button>
                        ))}
                    </div>
                </div>

                {estado === 'cerrado_con_reserva' && (
                    <div className="space-y-1">
                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Comentario obligatorio</label>
                        <textarea rows={3} value={comentario} onChange={e => setComentario(e.target.value)} placeholder="Describir la observación o reserva..."
                            className="w-full border border-slate-200 focus:border-rose-400 rounded-xl px-3 py-2 text-sm outline-none resize-none" />
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
    const [form, setForm] = useState({ nombre: material.nombre, unidad: material.unidad });
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
            <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 space-y-5">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-black text-slate-800">Editar Material</h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl"><X className="w-5 h-5" /></button>
                </div>
                <div className="space-y-3">
                    <div>
                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Nombre</label>
                        <input value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium outline-none focus:border-primary mt-1" />
                    </div>
                    <div>
                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Unidad</label>
                        <select value={form.unidad} onChange={e => setForm(p => ({ ...p, unidad: e.target.value }))} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-primary mt-1 bg-white text-slate-700">
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
            <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 space-y-5">
                <div className="flex flex-col items-center text-center space-y-3">
                    <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center mb-2">
                        <AlertTriangle className="w-6 h-6 text-rose-500" />
                    </div>
                    <h2 className="text-xl font-black text-slate-800">Eliminar material</h2>
                    <p className="text-sm font-medium text-slate-500">
                        ¿Estás seguro que deseas eliminar <span className="font-bold text-slate-700">{material.nombre}</span>? Esta acción no se puede deshacer.
                    </p>
                </div>
                <div className="flex gap-2">
                    <button onClick={onClose} disabled={deleting} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-black text-sm transition-colors">Cancelar</button>
                    <button onClick={handleConfirm} disabled={deleting} className="flex-1 py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50">
                        {deleting && <Loader2 className="w-4 h-4 animate-spin" />} Eliminar
                    </button>
                </div>
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
    const isVendedor = ['vendedor', 'supervisor', 'admin'].includes(user?.role);

    const handleUpdate = async (id: string, field: string, value: number) => {
        await fetch(`/api/materiales-proyecto/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [field]: value }),
        });
        onRefresh();
    };

    const handleMarkEntregado = async (id: string) => {
        await fetch(`/api/materiales-proyecto/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estado: 'material_entregado' }),
        });
        onRefresh();
    };

    const handleDelete = async (id: string) => {
        await fetch(`/api/materiales-proyecto/${id}`, { method: 'DELETE' });
        onRefresh();
    };

    const materiales = proyecto.materialesProyecto;
    const hayPendientes = materiales.some(m => m.estado === 'pendiente_devolucion');
    const hayCargados = materiales.some(m => ['material_cargado', 'material_entregado'].includes(m.estado));

    return (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            {/* Header */}
            <button
                onClick={() => setExpanded(p => !p)}
                className="w-full flex items-center justify-between p-4 md:p-5 hover:bg-slate-50 transition-colors"
            >
                <div className="flex items-center gap-3 text-left">
                    <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                        <Package className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-black text-slate-800 text-sm md:text-base">{proyecto.nombre}</h3>
                            {proyecto.codigoProyecto && <CodeBadge code={proyecto.codigoProyecto} variant="project" size="sm" showCopy={false} />}
                        </div>
                        <p className="text-xs text-slate-500 font-medium">
                            {proyecto.client?.nombre || proyecto.cliente || '—'} · {materiales.length} material{materiales.length !== 1 ? 'es' : ''}
                            {hayPendientes && <span className="ml-2 text-amber-600 font-black">⚠ Pendiente devolución</span>}
                        </p>
                    </div>
                </div>
                {expanded ? <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" /> : <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />}
            </button>

            {expanded && (
                <div className="border-t border-slate-100 p-4 md:p-5 space-y-4">
                    {/* Desktop table */}
                    {materiales.length > 0 ? (
                        <div className="overflow-x-auto -mx-1">
                            <table className="w-full text-sm min-w-[640px]">
                                <thead>
                                    <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        <th className="text-left pb-3 pl-2">Material</th>
                                        <th className="text-center pb-3">Solicitada</th>
                                        <th className="text-center pb-3">Disponible</th>
                                        <th className="text-center pb-3">Entregada</th>
                                        <th className="text-center pb-3">Utilizada</th>
                                        <th className="text-center pb-3">A devolver</th>
                                        <th className="text-center pb-3">Estado</th>
                                        <th className="text-center pb-3">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {materiales.map(mat => {
                                        const totalUsado = mat.usos.reduce((a, u) => a + u.cantidadUtilizada, 0);
                                        const aDevolver = mat.devolucion?.cantidadADevolver ?? Math.max(0, mat.cantidadEntregada - totalUsado);
                                        const closed = ['cerrado_ok', 'cerrado_con_reserva'].includes(mat.estado);
                                        return (
                                            <tr key={mat.id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="py-3 pl-2">
                                                    <span className="font-bold text-slate-700">{mat.nombre}</span>
                                                    <span className="ml-1.5 text-[10px] text-slate-400 font-medium uppercase">{mat.unidad}</span>
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
                                                        {isVendedor && mat.estado === 'material_cargado' && (
                                                            <button onClick={() => handleMarkEntregado(mat.id)} title="Marcar como entregado"
                                                                className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors">
                                                                <Package className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                        {isVendedor && !closed && (
                                                            <button onClick={() => setEditTarget(mat)} title="Editar"
                                                                className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-lg transition-colors">
                                                                <Edit2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                        {isVendedor && mat.estado === 'pendiente_devolucion' && (
                                                            <button onClick={() => setDevolucionTarget(mat)} title="Confirmar recepción"
                                                                className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg transition-colors">
                                                                <RotateCcw className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                        {isVendedor && !closed && mat.estado === 'material_cargado' && (
                                                            <button onClick={() => setDeleteTarget(mat)} title="Eliminar"
                                                                className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-500 rounded-lg transition-colors">
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                        {mat.devolucion?.comentario && (
                                                            <span title={mat.devolucion.comentario} className="p-1.5 text-slate-400">
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
                        <div className="text-center py-8 text-slate-400">
                            <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                            <p className="text-sm font-bold">Sin materiales cargados aún</p>
                        </div>
                    )}

                    {isVendedor && hayCargados && (
                        <AddMaterialForm proyectoId={proyecto.id} onAdded={onRefresh} />
                    )}
                    {isVendedor && materiales.length === 0 && (
                        <AddMaterialForm proyectoId={proyecto.id} onAdded={onRefresh} />
                    )}
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
        </div>
    );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function ProvisionMaterialesPage() {
    const [user, setUser] = useState<any>(null);
    const [proyectos, setProyectos] = useState<Proyecto[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'todos' | 'pendiente_devolucion' | 'cerrado'>('todos');

    useEffect(() => {
        const stored = localStorage.getItem('currentUser');
        if (stored) setUser(JSON.parse(stored));
    }, []);

    const userRole = user?.role?.toLowerCase()?.trim();
    const isAuthorized = ['vendedor', 'supervisor', 'admin'].includes(userRole || '');

    if (user && !isAuthorized) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[2.5rem] border border-slate-200 shadow-sm animate-in zoom-in-95 duration-300">
                <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mb-4">
                    <AlertTriangle className="w-8 h-8 text-rose-500" />
                </div>
                <h1 className="text-2xl font-black text-slate-800 tracking-tight">Acceso Denegado</h1>
                <p className="text-slate-500 font-medium mt-1">Tu rol no tiene permisos para esta vista.</p>
                <Link href="/" className="mt-8 px-8 py-3 bg-primary text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all">
                    Volver al Inicio
                </Link>
            </div>
        );
    }

    const loadData = useCallback(async (showLoader = false) => {
        if (showLoader) setLoading(true);
        const res = await fetch('/api/provision-proyectos');
        const data = await res.json();
        setProyectos(Array.isArray(data) ? data : []);
        if (showLoader) setLoading(false);
    }, []);

    useEffect(() => { loadData(true); }, [loadData]);

    const filteredProyectos = proyectos.filter(p => {
        if (filter === 'todos') return true;
        if (filter === 'pendiente_devolucion') return p.materialesProyecto.some(m => m.estado === 'pendiente_devolucion');
        if (filter === 'cerrado') return p.materialesProyecto.every(m => ['cerrado_ok', 'cerrado_con_reserva'].includes(m.estado));
        return true;
    });

    const stats = {
        total: proyectos.length,
        pendientes: proyectos.filter(p => p.materialesProyecto.some(m => m.estado === 'pendiente_devolucion')).length,
        cerrados: proyectos.filter(p => p.materialesProyecto.length > 0 && p.materialesProyecto.every(m => ['cerrado_ok', 'cerrado_con_reserva'].includes(m.estado))).length,
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <div className="p-3 bg-primary rounded-2xl shadow-lg shadow-primary/20">
                    <Package className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight">Provisión de Materiales</h1>
                    <p className="text-sm text-slate-500 font-medium">Gestión de entrega y devolución de materiales por proyecto</p>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-3 gap-3 md:gap-4">
                {[
                    { label: 'Proyectos activos', value: stats.total, color: 'bg-primary/10 text-primary' },
                    { label: 'Pendiente devolución', value: stats.pendientes, color: 'bg-amber-100 text-amber-700' },
                    { label: 'Completamente cerrados', value: stats.cerrados, color: 'bg-emerald-100 text-emerald-700' },
                ].map(k => (
                    <div key={k.label} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm text-center">
                        <div className={`text-2xl font-black ${k.color.split(' ')[1]}`}>{k.value}</div>
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{k.label}</div>
                    </div>
                ))}
            </div>

            {/* Filter tabs */}
            <div className="flex gap-2 bg-slate-100 p-1 rounded-2xl w-fit">
                {([
                    { key: 'todos', label: 'Todos' },
                    { key: 'pendiente_devolucion', label: '⚠ Pendiente devolución' },
                    { key: 'cerrado', label: '✓ Cerrados' },
                ] as const).map(t => (
                    <button key={t.key} onClick={() => setFilter(t.key)}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${filter === t.key ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
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
                <div className="bg-white border border-slate-200 rounded-3xl p-16 text-center shadow-sm">
                    <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p className="text-base font-black text-slate-500">Sin proyectos en este estado</p>
                    <p className="text-sm text-slate-400 mt-1">
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
        </div>
    );
}
