'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    Wrench, Plus, Search, ScanLine, Camera, ArrowLeft, X, Save, Trash2, Edit2,
    CheckCircle2, AlertTriangle, Clock, RefreshCw, Minus, ClipboardCheck, Filter,
    ChevronDown, ChevronUp, Package, QrCode, Printer, Eye, ShieldCheck, Settings2,
    Link as LinkIcon, Unlink, AlertCircle, Zap, Hammer, Droplets, Cog
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { QRCodeCanvas } from 'qrcode.react';
import { safeApiRequest } from '@/lib/offline';
import { showToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import SearchableSelect from '@/components/SearchableSelect';

// ═══════════════════════════════════ TYPES ═══════════════════════════════════
interface Tool {
    id: string;
    nombre: string;
    marca: string | null;
    descripcion: string | null;
    tipo: string;
    subtipo: string | null;
    rubro: string | null;
    controlActivo: boolean;
    periodoControl: number;
    ultimoControlFecha: string | null;
    ultimoControlOperador: string | null;
    estadoHerramienta: string | null;
    carroId: string | null;
    estadoControl: string | null;
    proximoControlFecha: string | null;
    diasRestantes: number | null;
    herramientas?: Tool[];
    carro?: { id: string; nombre: string } | null;
    cartMovementsAsCarro?: any[];
    verificaciones?: any[];
}

interface Operator { id: string; nombreCompleto: string; }
interface Project { id: string; nombre: string; codigoProyecto?: string; }

// ═══════════════════════════════════ CONSTANTS ═══════════════════════════════
const TIPOS = [
    { value: 'MANUAL', label: 'Manual', icon: <Hammer className="w-4 h-4" /> },
    { value: 'ELECTRICA', label: 'Eléctrica', icon: <Zap className="w-4 h-4" /> },
    { value: 'NEUMATICA', label: 'Neumática', icon: <Cog className="w-4 h-4" /> },
    { value: 'HIDRAULICA', label: 'Hidráulica', icon: <Droplets className="w-4 h-4" /> },
    { value: 'CARRO', label: 'Carro', icon: <Package className="w-4 h-4" /> },
];
const SUBTIPOS = ['CORTE', 'MEDICION', 'AJUSTE', 'PERFORACION', 'SUJECION'];
const RUBROS = ['ELECTRICIDAD', 'OBRA', 'TALLER', 'IT'];
const PERIODOS = [
    { value: 30, label: '30 días' },
    { value: 60, label: '60 días' },
    { value: 90, label: '90 días' },
    { value: 180, label: '180 días' },
    { value: 365, label: '365 días' },
];

const ESTADO_CONTROL_STYLES: Record<string, { label: string; cls: string }> = {
    NUNCA_CONTROLADA: { label: 'Nunca Controlada', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
    EN_VIGENCIA: { label: 'En Vigencia', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
    POR_VENCER: { label: 'Por Vencer', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    VENCIDO: { label: 'Vencido', cls: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

type TabId = 'herramientas' | 'carros' | 'retiros' | 'verificacion' | 'historial';

// ═══════════════════════════════════ MAIN PAGE ═══════════════════════════════
import { Suspense } from 'react';

export default function HerramientasPageWrapper() {
    return (
        <Suspense fallback={
            <div className="min-h-[60vh] flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
        }>
            <HerramientasPage />
        </Suspense>
    );
}

function HerramientasPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialTab = (searchParams.get('tab') as TabId) || 'herramientas';

    const [currentUser, setCurrentUser] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<TabId>(initialTab);

    useEffect(() => {
        const stored = localStorage.getItem('currentUser');
        if (stored) {
            setCurrentUser(JSON.parse(stored));
        } else {
            router.replace('/');
        }
    }, [router]);

    const role = currentUser?.role?.toLowerCase() || 'operador';

    const tabs: { id: TabId; label: string; icon: React.ReactNode; roles: string[] }[] = [
        { id: 'herramientas', label: 'Herramientas', icon: <Wrench className="w-4 h-4" />, roles: ['supervisor', 'admin'] },
        { id: 'carros', label: 'Carros', icon: <Package className="w-4 h-4" />, roles: ['supervisor', 'admin'] },
        { id: 'retiros', label: 'Retiros', icon: <ScanLine className="w-4 h-4" />, roles: ['operador', 'supervisor', 'admin'] },
        { id: 'verificacion', label: 'Verificación', icon: <ShieldCheck className="w-4 h-4" />, roles: ['operador', 'supervisor', 'admin'] },
        { id: 'historial', label: 'Historial', icon: <Clock className="w-4 h-4" />, roles: ['supervisor', 'admin'] },
    ];

    const allowedTabs = useMemo(() => tabs.filter(t => t.roles.includes(role)), [role]);

    // Default to first allowed tab if current isn't allowed
    useEffect(() => {
        if (!allowedTabs.find(t => t.id === activeTab) && allowedTabs.length > 0) {
            setActiveTab(allowedTabs[0].id);
        }
    }, [role, allowedTabs, activeTab]);

    // Loading state — all hooks have been called above
    if (!currentUser) return (
        <div className="min-h-[60vh] flex items-center justify-center">
            <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <div className="space-y-1">
                    <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight flex items-center gap-2 md:gap-3">
                        <Wrench className="w-6 h-6 md:w-8 md:h-8 text-primary" />
                        Herramientas y Carros
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium hidden md:block">
                        Gestión unificada de herramientas, carros, retiros y verificación
                    </p>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-1.5 shadow-sm overflow-x-auto">
                {allowedTabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-1.5 px-3 md:px-5 py-2 md:py-2.5 rounded-xl text-xs md:text-sm font-black transition-all whitespace-nowrap ${
                            activeTab === tab.id
                                ? 'bg-primary text-white shadow-md shadow-primary/20'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80'
                        }`}
                    >
                        {tab.icon}
                        <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="animate-in fade-in duration-300">
                {activeTab === 'herramientas' && <HerramientasTab user={currentUser} />}
                {activeTab === 'carros' && <CarrosTab user={currentUser} />}
                {activeTab === 'retiros' && <RetirosTab user={currentUser} />}
                {activeTab === 'verificacion' && <VerificacionTab user={currentUser} />}
                {activeTab === 'historial' && <HistorialTab user={currentUser} />}
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: HERRAMIENTAS — CRUD completo
// ═══════════════════════════════════════════════════════════════════════════════
function HerramientasTab({ user }: { user: any }) {
    const [tools, setTools] = useState<Tool[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingTool, setEditingTool] = useState<Tool | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterTipo, setFilterTipo] = useState('');
    const [deletingTool, setDeletingTool] = useState<Tool | null>(null);
    const [qrTool, setQrTool] = useState<Tool | null>(null);
    const qrRef = useRef<HTMLDivElement>(null);

    // Brands
    const [marcas, setMarcas] = useState<string[]>([]);

    // Form state
    const [form, setForm] = useState({
        nombre: '', marca: '', descripcion: '', tipo: 'MANUAL',
        subtipo: '', rubro: '', controlActivo: false, periodoControl: 60,
        cantidad: 1
    });

    useEffect(() => { loadTools(); loadMarcas(); }, []);

    const loadTools = async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams();
            if (searchQuery) params.set('search', searchQuery);
            if (filterTipo) params.set('tipo', filterTipo);
            const res = await safeApiRequest(`/api/herramientas?${params}`);
            if (res.ok) setTools(await res.json());
        } catch (e) { console.error(e); }
        finally { setIsLoading(false); }
    };

    const loadMarcas = async () => {
        try {
            const res = await safeApiRequest('/api/config/options?category=MARCA_HERRAMIENTA');
            if (res.ok) {
                const data = await res.json();
                setMarcas(Array.isArray(data) ? data.filter((d: any) => d.active).map((d: any) => d.value) : []);
            }
        } catch (e) { console.error(e); }
    };

    const resetForm = () => {
        setForm({ nombre: '', marca: '', descripcion: '', tipo: 'MANUAL', subtipo: '', rubro: '', controlActivo: false, periodoControl: 60, cantidad: 1 });
        setShowForm(false);
        setEditingTool(null);
    };

    const handleSave = async () => {
        if (!form.nombre.trim()) { showToast('El nombre es obligatorio', 'error'); return; }

        const submitForm = { ...form, cantidad: Math.max(1, Number(form.cantidad) || 1) };

        try {
            if (editingTool) {
                const res = await safeApiRequest(`/api/herramientas/${editingTool.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(submitForm)
                });
                if (!res.ok) { const e = await res.json(); showToast(e.error || 'Error', 'error'); return; }
                showToast('Herramienta actualizada', 'success');
            } else {
                const res = await safeApiRequest('/api/herramientas', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(submitForm)
                });
                if (!res.ok) { const e = await res.json(); showToast(e.error || 'Error', 'error'); return; }
                showToast(submitForm.cantidad > 1 ? `${submitForm.cantidad} herramientas creadas` : 'Herramienta creada', 'success');
            }
            resetForm();
            loadTools();
        } catch (e) { showToast('Error de conexión', 'error'); }
    };

    const handleEdit = (tool: Tool) => {
        setEditingTool(tool);
        setForm({
            nombre: tool.nombre, marca: tool.marca || '', descripcion: tool.descripcion || '',
            tipo: tool.tipo, subtipo: tool.subtipo || '', rubro: tool.rubro || '',
            controlActivo: tool.controlActivo, periodoControl: tool.periodoControl, cantidad: 1
        });
        setShowForm(true);
    };

    const handleDelete = async (tool: Tool) => {
        try {
            const res = await safeApiRequest(`/api/herramientas/${tool.id}`, { method: 'DELETE' });
            if (!res.ok) { const e = await res.json(); showToast(e.error || 'No se puede eliminar', 'error'); return; }
            showToast('Herramienta eliminada', 'success');
            loadTools();
        } catch (e) { showToast('Error de conexión', 'error'); }
        setDeletingTool(null);
    };

    const handleAddMarca = async (nuevaMarca: string) => {
        try {
            await safeApiRequest('/api/config/options', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ category: 'MARCA_HERRAMIENTA', value: nuevaMarca, active: true, order: 0 })
            });
            setMarcas(prev => [...prev, nuevaMarca].sort());
            setForm(prev => ({ ...prev, marca: nuevaMarca }));
            showToast(`Marca "${nuevaMarca}" agregada`, 'success');
        } catch { showToast('Error al agregar marca', 'error'); }
    };

    const handlePrintQr = (tool: Tool) => {
        if (!qrRef.current) return;
        const canvas = qrRef.current.querySelector('canvas') as HTMLCanvasElement;
        if (!canvas) return;
        const qrDataUrl = canvas.toDataURL('image/png');
        const printWindow = window.open('', '_blank', 'width=700,height=500');
        if (!printWindow) { showToast('El navegador bloqueó la ventana emergente. Permitir pop-ups.', 'error'); return; }
        printWindow.document.write(`<!DOCTYPE html><html><head><title>QR - ${tool.nombre}</title>
        <style>@page{size:landscape;margin:0}*{box-sizing:border-box;margin:0;padding:0}body{display:flex;align-items:center;justify-content:center;height:100vh;background:#fff;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif}.tarjetero{width:100mm;height:60mm;border:1px solid #eee;display:flex;align-items:center;padding:5mm;gap:8mm;overflow:hidden}.qr-container{flex-shrink:0;display:flex;align-items:center}.qr-container img{width:45mm;height:45mm}.info{display:flex;flex-direction:column;justify-content:center;border-left:2px solid #f1f5f9;padding-left:6mm;height:40mm}.info h2{font-size:20px;font-weight:900;color:#0f172a;text-transform:uppercase;line-height:1.1;margin-bottom:4px;max-width:40mm;word-wrap:break-word}.info .label{font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:1.5px;font-weight:800;margin-bottom:8px}.info .id{font-size:11px;color:#94a3b8;font-family:'Courier New',Courier,monospace;font-weight:bold;background:#f8fafc;padding:4px 8px;border-radius:4px}</style>
        </head><body><div class="tarjetero"><div class="qr-container"><img id="qrimg" src="${qrDataUrl}" alt="QR"/></div><div class="info"><div class="label">Herramienta</div><h2>${tool.nombre}</h2><div class="id">ID: ${tool.id}</div></div></div>
        <script>
        var img = document.getElementById('qrimg');
        function doPrint() { window.focus(); window.print(); }
        if (img.complete) { setTimeout(doPrint, 300); }
        else { img.onload = function() { setTimeout(doPrint, 300); }; }
        <\/script></body></html>`);
        printWindow.document.close();
    };

    const filteredTools = useMemo(() => {
        let result = tools;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(t =>
                t.nombre.toLowerCase().includes(q) ||
                t.id.toLowerCase().includes(q) ||
                (t.marca && t.marca.toLowerCase().includes(q))
            );
        }
        if (filterTipo) result = result.filter(t => t.tipo === filterTipo);
        return result;
    }, [tools, searchQuery, filterTipo]);

    return (
        <div className="space-y-6">
            {/* Actions Bar */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text" placeholder="Buscar por nombre, ID o marca..."
                        value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                </div>
                <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)}
                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:border-primary">
                    <option value="">Todos los tipos</option>
                    {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <button onClick={() => { resetForm(); setShowForm(true); }}
                    className="flex items-center justify-center gap-2 bg-primary text-white px-6 py-3 rounded-2xl font-black text-sm hover:bg-primary/90 transition-all active:scale-95 shadow-md shadow-primary/20 whitespace-nowrap">
                    <Plus className="w-5 h-5" /> Crear Herramienta
                </button>
            </div>

            {/* Creation / Edit Form */}
            {showForm && (
                <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 animate-in slide-in-from-top-4 duration-300">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">
                            {editingTool ? `Editar: ${editingTool.id}` : 'Nueva Herramienta'}
                        </h3>
                        <button onClick={resetForm} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-slate-400">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* Nombre */}
                        <div className="lg:col-span-2">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Nombre *</label>
                            <input type="text" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })}
                                placeholder="Ej: Amoladora 9 pulgadas" className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 px-4 text-sm font-bold outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
                        </div>

                        {/* Marca */}
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Marca</label>
                            <SearchableSelect
                                options={marcas.map(m => ({ id: m, label: m }))}
                                value={form.marca}
                                onChange={v => setForm({ ...form, marca: v })}
                                placeholder="Seleccionar marca..."
                                allowCreate
                                onCreateOption={handleAddMarca}
                                createLabel="Agregar marca"
                            />
                        </div>

                        {/* Tipo */}
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Tipo *</label>
                            <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}
                                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 px-4 text-sm font-bold outline-none focus:border-primary">
                                {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                        </div>

                        {/* Subtipo */}
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Subtipo</label>
                            <select value={form.subtipo} onChange={e => setForm({ ...form, subtipo: e.target.value })}
                                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 px-4 text-sm font-bold outline-none focus:border-primary">
                                <option value="">Sin subtipo</option>
                                {SUBTIPOS.map(s => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
                            </select>
                        </div>

                        {/* Rubro */}
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Rubro</label>
                            <select value={form.rubro} onChange={e => setForm({ ...form, rubro: e.target.value })}
                                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 px-4 text-sm font-bold outline-none focus:border-primary">
                                <option value="">Sin rubro</option>
                                {RUBROS.map(r => <option key={r} value={r}>{r.charAt(0) + r.slice(1).toLowerCase()}</option>)}
                            </select>
                        </div>

                        {/* Descripción */}
                        <div className="lg:col-span-3">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Descripción (Opcional)</label>
                            <textarea value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })}
                                rows={2} placeholder="Descripción larga opcional..."
                                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 px-4 text-sm font-bold outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none" />
                        </div>

                        {/* Control */}
                        <div className="lg:col-span-3 bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-800">
                            <div className="flex items-center justify-between mb-3">
                                <label className="text-sm font-black text-slate-700 dark:text-slate-200 flex items-center gap-2">
                                    <ShieldCheck className="w-4 h-4 text-primary" /> Control de Verificación
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setForm({ ...form, controlActivo: !form.controlActivo })}
                                    className={`w-12 h-7 !min-h-0 shrink-0 rounded-full transition-all duration-300 relative ${form.controlActivo ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'}`}
                                >
                                    <div className={`w-5 h-5 bg-white rounded-full shadow-md absolute top-1 transition-all duration-300 ${form.controlActivo ? 'left-6' : 'left-1'}`} />
                                </button>
                            </div>
                            {form.controlActivo && (
                                <div className="animate-in slide-in-from-top-2 duration-200">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Periodo de Vencimiento</label>
                                    <select value={form.periodoControl} onChange={e => setForm({ ...form, periodoControl: parseInt(e.target.value) })}
                                        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-4 text-sm font-bold outline-none focus:border-primary">
                                        {PERIODOS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                                    </select>
                                </div>
                            )}
                        </div>

                        {/* Cantidad (solo para creación) */}
                        {!editingTool && (
                            <div className="lg:col-span-3">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Cantidad</label>
                                <div className="flex items-center gap-3">
                                    <input type="number" min={1} max={100} value={form.cantidad}
                                        onChange={e => {
                                            const val = e.target.value;
                                            setForm({ ...form, cantidad: val === '' ? ('' as any) : Math.min(100, parseInt(val) || 0) });
                                        }}
                                        onBlur={() => {
                                            if (!form.cantidad || form.cantidad < 1) setForm({ ...form, cantidad: 1 });
                                        }}
                                        className="w-24 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 px-4 text-sm font-bold text-center outline-none focus:border-primary" />
                                    {form.cantidad > 1 && (
                                        <p className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                                            <AlertCircle className="w-4 h-4" />
                                            Se crearán {form.cantidad} herramientas con IDs distintos
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-3 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                        <button onClick={handleSave}
                            className="flex-1 py-3 bg-primary text-white rounded-xl font-black text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-all active:scale-95 shadow-md shadow-primary/20">
                            <Save className="w-4 h-4" /> {editingTool ? 'Guardar Cambios' : 'Crear'}
                        </button>
                        <button onClick={resetForm}
                            className="py-3 px-6 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-black text-sm hover:bg-slate-200 transition-all">
                            Cancelar
                        </button>
                    </div>
                </div>
            )}

            {/* Tools List */}
            {isLoading ? (
                <div className="flex items-center justify-center py-16">
                    <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                </div>
            ) : filteredTools.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-700">
                    <Wrench className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm font-bold text-slate-500">No hay herramientas registradas.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {filteredTools.map(tool => (
                        <div key={tool.id} className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col gap-3 hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start">
                                <div className="flex-1 min-w-0">
                                    <h5 className="font-black text-slate-800 dark:text-slate-100 text-base truncate">{tool.nombre}</h5>
                                    <div className="flex flex-wrap gap-1.5 mt-1">
                                        <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400">{tool.tipo}</span>
                                        {tool.marca && <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">{tool.marca}</span>}
                                        {tool.subtipo && <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400">{tool.subtipo}</span>}
                                        {tool.rubro && <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400">{tool.rubro}</span>}
                                    </div>
                                </div>
                                <div className="flex gap-1 shrink-0 ml-2">
                                    <button onClick={() => setQrTool(tool)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors" title="QR"><QrCode className="w-4 h-4" /></button>
                                    <button onClick={() => handleEdit(tool)} className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors" title="Editar"><Edit2 className="w-4 h-4" /></button>
                                    <button onClick={() => setDeletingTool(tool)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Eliminar"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            </div>

                            {/* Control badge */}
                            {tool.estadoControl && (
                                <div className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg w-fit ${ESTADO_CONTROL_STYLES[tool.estadoControl]?.cls || ''}`}>
                                    {ESTADO_CONTROL_STYLES[tool.estadoControl]?.label}
                                    {tool.diasRestantes !== null && tool.diasRestantes >= 0 && <span className="ml-1">({tool.diasRestantes}d)</span>}
                                </div>
                            )}

                            {/* Cart assignment */}
                            {tool.carroId && tool.carro && (
                                <div className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                                    <LinkIcon className="w-3 h-3" /> En carro: <span className="text-slate-700 dark:text-slate-300">{tool.carro.nombre}</span>
                                </div>
                            )}

                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 font-mono">ID: {tool.id}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* QR Modal */}
            {qrTool && (
                <div className="fixed inset-0 z-[110] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setQrTool(null)}>
                    <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-2xl max-w-sm w-full animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="text-center mb-6">
                            <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100">{qrTool.nombre}</h3>
                            <p className="text-sm font-bold text-slate-500 mt-1">ID: {qrTool.id}</p>
                        </div>
                        <div className="flex justify-center bg-white p-4 rounded-xl border-2 border-dashed border-slate-200 mb-6" ref={qrRef}>
                            <QRCodeCanvas value={`TOOL:${qrTool.id}`} size={200} level="H" includeMargin={true} />
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setQrTool(null)} className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors">Cerrar</button>
                            <button onClick={() => handlePrintQr(qrTool)} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2">
                                <Printer className="w-4 h-4" /> Imprimir
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmDialog isOpen={deletingTool !== null} title="Eliminar Herramienta"
                message={`¿Seguro que deseas eliminar "${deletingTool?.nombre}" (${deletingTool?.id})?`}
                onConfirm={() => deletingTool && handleDelete(deletingTool)}
                onCancel={() => setDeletingTool(null)} confirmLabel="Eliminar" />
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: CARROS — Configuración y estado operativo
// ═══════════════════════════════════════════════════════════════════════════════
function CarrosTab({ user }: { user: any }) {
    const [carros, setCarros] = useState<Tool[]>([]);
    const [allTools, setAllTools] = useState<Tool[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedCarro, setSelectedCarro] = useState<Tool | null>(null);
    const [assigningToolId, setAssigningToolId] = useState('');
    const qrRef = useRef<HTMLDivElement>(null);

    useEffect(() => { loadCarros(); loadAssignableTools(); }, []);

    const loadCarros = async () => {
        setIsLoading(true);
        try {
            const res = await safeApiRequest('/api/herramientas?soloCarros=true');
            if (res.ok) setCarros(await res.json());
        } catch (e) { console.error(e); }
        finally { setIsLoading(false); }
    };

    const loadAssignableTools = async () => {
        try {
            const res = await safeApiRequest('/api/herramientas?sinAsignar=true');
            if (res.ok) setAllTools(await res.json());
        } catch (e) { console.error(e); }
    };

    const handleAssign = async () => {
        if (!assigningToolId || !selectedCarro) return;
        try {
            const res = await safeApiRequest('/api/herramientas/asignar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ toolId: assigningToolId, carroId: selectedCarro.id })
            });
            if (!res.ok) { const e = await res.json(); showToast(e.error, 'error'); return; }
            showToast('Herramienta asignada al carro', 'success');
            setAssigningToolId('');
            loadCarros();
            loadAssignableTools();
            // Refresh selected carro
            const r2 = await safeApiRequest(`/api/carros/${selectedCarro.id}`);
            if (r2.ok) setSelectedCarro(await r2.json());
        } catch (e) { showToast('Error de conexión', 'error'); }
    };

    const handleUnassign = async (toolId: string) => {
        try {
            const res = await safeApiRequest(`/api/herramientas/asignar?toolId=${toolId}`, { method: 'DELETE' });
            if (!res.ok) { const e = await res.json(); showToast(e.error, 'error'); return; }
            showToast('Herramienta desasignada', 'success');
            loadCarros();
            loadAssignableTools();
            if (selectedCarro) {
                const r2 = await safeApiRequest(`/api/carros/${selectedCarro.id}`);
                if (r2.ok) setSelectedCarro(await r2.json());
            }
        } catch (e) { showToast('Error de conexión', 'error'); }
    };

    const handlePrintAllQrs = () => {
        if (!selectedCarro?.herramientas?.length) return;
        const tools = selectedCarro.herramientas;
        const blocks = tools.map(t => {
            const canvas = document.getElementById(`qr-batch-${t.id}`) as HTMLCanvasElement;
            const dataUrl = canvas ? canvas.toDataURL('image/png') : '';
            return `<div class="card"><div class="qr"><img src="${dataUrl}"/></div><div class="info"><div class="nm">${t.nombre}</div><div class="id">${t.id}</div></div></div>`;
        }).join('');

        const printWindow = window.open('', '_blank', 'width=900,height=700');
        if (!printWindow) { showToast('El navegador bloqueó la ventana emergente. Permitir pop-ups.', 'error'); return; }
        
        printWindow.document.write(`<!DOCTYPE html><html><head><title>QRs - ${selectedCarro.nombre}</title>
        <style>@page{margin:10mm}*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Roboto,sans-serif}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8mm}.card{border:1px solid #e2e8f0;border-radius:8px;padding:4mm;display:flex;align-items:center;gap:4mm;break-inside:avoid}.qr img{width:25mm;height:25mm}.info{flex:1}.nm{font-size:11px;font-weight:900;color:#0f172a;text-transform:uppercase}.id{font-size:9px;color:#94a3b8;font-family:monospace;margin-top:2px}</style>
        </head><body><h1 style="font-size:16px;margin-bottom:6mm;color:#334155">${selectedCarro.nombre} — Herramientas</h1><div class="grid">${blocks}</div>
        <script>
        setTimeout(function() { window.focus(); window.print(); }, 300);
        <\/script></body></html>`);
        printWindow.document.close();
    };

    // Count control issues across selected cart's tools
    const controlIssues = useMemo(() => {
        if (!selectedCarro?.herramientas) return { porVencer: 0, vencidas: 0 };
        return {
            porVencer: selectedCarro.herramientas.filter((h: any) => h.estadoControl === 'POR_VENCER').length,
            vencidas: selectedCarro.herramientas.filter((h: any) => h.estadoControl === 'VENCIDO').length,
        };
    }, [selectedCarro]);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Cart List */}
                <div className="space-y-3">
                    <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest flex items-center gap-2">
                        <Package className="w-4 h-4 text-primary" /> Carros
                    </h3>
                    {isLoading ? (
                        <div className="flex justify-center py-8"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>
                    ) : carros.length === 0 ? (
                        <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 text-center border border-slate-200 dark:border-slate-700">
                            <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                            <p className="text-xs font-bold text-slate-400">No hay carros. Cree uno en la pestaña Herramientas con tipo "Carro".</p>
                        </div>
                    ) : (
                        carros.map(carro => {
                            const isSelected = selectedCarro?.id === carro.id;
                            const hasActiveMovement = (carro as any).cartMovementsAsCarro?.length > 0;
                            return (
                                <button key={carro.id} onClick={() => setSelectedCarro(carro)}
                                    className={`w-full text-left bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border transition-all ${
                                        isSelected
                                            ? 'border-primary ring-2 ring-primary/20'
                                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                                    }`}>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h5 className="font-black text-slate-800 dark:text-slate-100">{carro.nombre}</h5>
                                            <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                                                {carro.herramientas?.length || 0} herramientas
                                            </p>
                                        </div>
                                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${
                                            hasActiveMovement
                                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                        }`}>
                                            {hasActiveMovement ? 'En Uso' : 'Disponible'}
                                        </span>
                                    </div>
                                </button>
                            );
                        })
                    )}
                </div>

                {/* Cart Detail */}
                <div className="lg:col-span-2">
                    {!selectedCarro ? (
                        <div className="bg-white dark:bg-slate-800 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-700">
                            <Settings2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                            <p className="text-sm font-bold text-slate-400">Seleccioná un carro para ver su configuración</p>
                        </div>
                    ) : (
                        <div className="space-y-4 animate-in fade-in duration-300">
                            {/* Cart Header */}
                            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">{selectedCarro.nombre}</h3>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 font-mono mt-1">ID: {selectedCarro.id}</p>
                                    </div>
                                    <button onClick={handlePrintAllQrs} disabled={!selectedCarro.herramientas?.length}
                                        className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl font-bold text-xs hover:bg-indigo-100 transition-colors disabled:opacity-40">
                                        <Printer className="w-4 h-4" /> Imprimir QRs
                                    </button>
                                </div>

                                {/* Control Alerts */}
                                {(controlIssues.vencidas > 0 || controlIssues.porVencer > 0) && (
                                    <div className="flex flex-wrap gap-3 mb-4">
                                        {controlIssues.vencidas > 0 && (
                                            <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-3 py-2 rounded-xl text-xs font-black">
                                                <AlertTriangle className="w-4 h-4" /> {controlIssues.vencidas} vencida(s)
                                            </div>
                                        )}
                                        {controlIssues.porVencer > 0 && (
                                            <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 px-3 py-2 rounded-xl text-xs font-black">
                                                <Clock className="w-4 h-4" /> {controlIssues.porVencer} por vencer
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Assign Tool */}
                                <div className="flex gap-2 mb-4">
                                    <div className="flex-1 min-w-0">
                                        <SearchableSelect
                                            options={allTools.map(t => ({ id: t.id, label: `${t.nombre} (${t.id})` }))}
                                            value={assigningToolId}
                                            onChange={setAssigningToolId}
                                            placeholder="Agregar herramienta al carro..."
                                        />
                                    </div>
                                    <button onClick={handleAssign} disabled={!assigningToolId}
                                        className="px-4 py-2 shrink-0 bg-primary text-white rounded-xl font-bold text-xs disabled:opacity-40 hover:bg-primary/90 transition-all active:scale-95 flex items-center gap-1.5 whitespace-nowrap">
                                        <LinkIcon className="w-4 h-4" /> Asignar
                                    </button>
                                </div>

                                {/* Tools in Cart */}
                                <div className="space-y-2">
                                    {selectedCarro.herramientas && selectedCarro.herramientas.length > 0 ? (
                                        selectedCarro.herramientas.map((h: any) => (
                                            <div key={h.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-700">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-black text-slate-800 dark:text-slate-100 truncate">{h.nombre}</p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-[9px] font-mono font-bold text-slate-400">{h.id}</span>
                                                        {h.estadoControl && (
                                                            <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${ESTADO_CONTROL_STYLES[h.estadoControl]?.cls || ''}`}>
                                                                {ESTADO_CONTROL_STYLES[h.estadoControl]?.label}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <button onClick={() => handleUnassign(h.id)}
                                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors shrink-0" title="Desasignar">
                                                    <Unlink className="w-4 h-4" />
                                                </button>
                                                {/* Hidden QR for batch print */}
                                                <div className="hidden"><QRCodeCanvas id={`qr-batch-${h.id}`} value={`TOOL:${h.id}`} size={100} level="H" /></div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="py-4 text-center text-xs font-bold text-slate-400">
                                            Este carro no tiene herramientas asignadas.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: RETIROS — Checkout / Checkin (migrado de /carros)
// ═══════════════════════════════════════════════════════════════════════════════
function RetirosTab({ user }: { user: any }) {
    const [activeMovements, setActiveMovements] = useState<any[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [isScanning, setIsScanning] = useState(false);
    const [manualId, setManualId] = useState('');
    const scanHandledRef = useRef(false);

    const [mode, setMode] = useState<'IDLE' | 'CHECKOUT' | 'CHECKIN'>('IDLE');
    const [selectedCart, setSelectedCart] = useState<any>(null);
    const [selectedMovement, setSelectedMovement] = useState<any>(null);
    const [checklist, setChecklist] = useState<any[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [newToolName, setNewToolName] = useState('');
    const [newToolQty, setNewToolQty] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [isConfirmingCheckout, setIsConfirmingCheckout] = useState(false);
    const [isConfirmingCheckin, setIsConfirmingCheckin] = useState(false);
    const [isWarningCheckout, setIsWarningCheckout] = useState(false);

    useEffect(() => {
        loadActiveMovements();
        loadProjects();
    }, []);

    const loadActiveMovements = async () => {
        try {
            const res = await safeApiRequest(`/api/carros/movements/active?operatorId=${user.id}`);
            if (res.ok) setActiveMovements(await res.json());
        } catch (e) { console.error(e); }
    };

    const loadProjects = async () => {
        try {
            const res = await safeApiRequest('/api/projects');
            if (res.ok) setProjects(await res.json());
        } catch (e) { console.error(e); }
    };

    const handleBack = () => {
        setMode('IDLE');
        setSelectedCart(null);
        setSelectedMovement(null);
        setChecklist([]);
        scanHandledRef.current = false;
    };

    const handleScanSuccess = async (text: string) => {
        if (scanHandledRef.current) return;
        scanHandledRef.current = true;
        setIsScanning(false);
        let cartId = text;
        if (text.startsWith('TOOLCART:')) cartId = text.split(':')[1];
        else if (text.startsWith('TOOL:')) cartId = text.split(':')[1];
        loadCartForCheckout(cartId);
    };

    const handleManualLookup = () => {
        if (!manualId.trim()) return;
        loadCartForCheckout(manualId.trim());
    };

    const loadCartForCheckout = async (id: string) => {
        setIsLoading(true);
        try {
            const res = await safeApiRequest(`/api/carros/${id}`);
            if (!res.ok) { showToast('Carro no encontrado o inválido', 'error'); return; }
            const cart = await res.json();
            if (cart.tipo !== 'CARRO') { showToast('Este ID no corresponde a un carro', 'error'); return; }

            const hasActiveMovement = cart.cartMovementsAsCarro?.some((m: any) => m.estado === 'ACTIVO');
            if (hasActiveMovement) { showToast('El carro ya está en uso', 'error'); return; }

            setSelectedCart(cart);
            setChecklist((cart.herramientas || []).map((h: any) => ({
                id: h.id, nombre: h.nombre, cantidad: 1, cantidadOut: 0,
                estadoControl: h.estadoControl
            })));
            setMode('CHECKOUT');
        } catch (e) { showToast('Error de conexión', 'error'); }
        finally { setIsLoading(false); }
    };

    const handleCheckoutPrecheck = () => {
        const hasExpiredTools = checklist.some(c => c.estadoControl === 'VENCIDO' || c.estadoControl === 'POR_VENCER');
        if (hasExpiredTools) {
            setIsWarningCheckout(true);
        } else {
            setIsConfirmingCheckout(true);
        }
    };

    const handleAddNewTool = () => {
        if (!newToolName.trim()) return;
        setChecklist(prev => [...prev, {
            id: `t_${Date.now()}`, nombre: newToolName.trim(),
            cantidad: newToolQty, cantidadOut: newToolQty, isAdditional: true
        }]);
        setNewToolName('');
        setNewToolQty(1);
    };

    const updateToolQty = (id: string, val: number, isCheckout: boolean) => {
        setChecklist(prev => prev.map(c => {
            if (c.id !== id) return c;
            const newVal = Math.min(c.cantidad, Math.max(0, val));
            return isCheckout ? { ...c, cantidadOut: newVal } : { ...c, cantidadIn: newVal };
        }));
    };

    const submitCheckout = async () => {
        if (!selectedProjectId) { showToast('Debe seleccionar un proyecto', 'error'); return; }
        setIsConfirmingCheckout(false);
        setIsLoading(true);
        try {
            const res = await safeApiRequest('/api/carros/movements/out', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cartId: selectedCart.id, operatorId: user.id, projectId: selectedProjectId, tools: checklist })
            });
            if (!res.ok) { const d = await res.json(); showToast(d.error || 'Fallo la salida', 'error'); return; }
            showToast('Salida registrada con éxito', 'success');
            await loadActiveMovements();
            handleBack();
        } catch (e) { showToast('Error de conexión', 'error'); }
        finally { setIsLoading(false); }
    };

    const startCheckin = (mov: any) => {
        setSelectedMovement(mov);
        setChecklist(mov.items.map((i: any) => ({ ...i, cantidadIn: i.cantidad })));
        setMode('CHECKIN');
    };

    const submitCheckin = async () => {
        setIsConfirmingCheckin(false);
        setIsLoading(true);
        try {
            const res = await safeApiRequest('/api/carros/movements/in', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    movementId: selectedMovement.id,
                    tools: checklist.map((c: any) => ({ id: c.id, nombre: c.nombre, cantidadIn: c.cantidadIn, expectedQty: c.cantidad }))
                })
            });
            if (!res.ok) { const d = await res.json(); showToast(d.error || 'Fallo la devolución', 'error'); return; }
            showToast('Devolución registrada con éxito', 'success');
            await loadActiveMovements();
            handleBack();
        } catch (e) { showToast('Error de conexión', 'error'); }
        finally { setIsLoading(false); }
    };

    const missingOutCount = checklist.filter(c => (c.cantidadOut || 0) < c.cantidad).length;
    const missingInCount = checklist.filter(c => (c.cantidadIn || 0) < c.cantidad).length;

    return (
        <div className="max-w-lg mx-auto space-y-6">
            {mode === 'IDLE' && (
                <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
                    {/* Scanner */}
                    <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 text-center">
                        <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mx-auto mb-4">
                            <ScanLine className="w-8 h-8" />
                        </div>
                        <h2 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-2">Retirar un Carro</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 font-medium">Escanea el código QR del carro para registrar su salida.</p>
                        <button type="button" onClick={() => setIsScanning(true)}
                            className="w-full py-3.5 bg-primary text-white rounded-2xl font-black text-sm hover:bg-primary/90 transition-all flex items-center justify-center gap-2 active:scale-95 shadow-md">
                            <Camera className="w-5 h-5" /> Escanear QR
                        </button>
                        <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">O ingresa el ID manual</p>
                            <div className="flex gap-2">
                                <input type="text" placeholder="ID del Carro" value={manualId}
                                    onChange={e => setManualId(e.target.value)}
                                    className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
                                <button type="button" onClick={handleManualLookup} disabled={isLoading || !manualId}
                                    className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-4 rounded-xl flex items-center justify-center disabled:opacity-50">
                                    <Search className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Active Movements */}
                    {activeMovements.length > 0 && (
                        <div className="space-y-4">
                            <h3 className="font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest text-sm flex items-center gap-2">
                                <Wrench className="w-4 h-4 text-primary" /> Mis Carros en Uso
                            </h3>
                            {activeMovements.map(mov => (
                                <div key={mov.id} className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col gap-4">
                                    <div>
                                        <h4 className="font-black text-slate-800 dark:text-slate-100 text-lg">{mov.cart?.nombre || mov.carro?.nombre}</h4>
                                        <p className="text-xs font-bold text-slate-500">Obra: {mov.project.nombre}</p>
                                    </div>
                                    <button type="button" onClick={() => startCheckin(mov)}
                                        className="w-full py-3 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-xl font-bold text-sm hover:ring-2 hover:ring-primary/50 transition-all flex items-center justify-center gap-2">
                                        <RefreshCw className="w-4 h-4 text-slate-500" /> Devolver Carro
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {isScanning && <ScannerModal onScan={handleScanSuccess} onClose={() => setIsScanning(false)} />}

            {mode === 'CHECKOUT' && selectedCart && (
                <CheckoutCheckinView
                    type="checkout" title={selectedCart.nombre} checklist={checklist}
                    updateToolQty={updateToolQty} projects={projects}
                    selectedProjectId={selectedProjectId} setSelectedProjectId={setSelectedProjectId}
                    newToolName={newToolName} setNewToolName={setNewToolName}
                    newToolQty={newToolQty} setNewToolQty={setNewToolQty}
                    handleAddNewTool={handleAddNewTool} missingCount={missingOutCount}
                    isLoading={isLoading} onBack={handleBack}
                    onSubmit={handleCheckoutPrecheck}
                />
            )}
            {mode === 'CHECKIN' && selectedMovement && (
                <CheckoutCheckinView
                    type="checkin" title={selectedMovement.cart?.nombre || selectedMovement.carro?.nombre}
                    subtitle={`Obra: ${selectedMovement.project.nombre}`}
                    checklist={checklist} updateToolQty={updateToolQty}
                    missingCount={missingInCount} isLoading={isLoading}
                    onBack={handleBack} onSubmit={() => setIsConfirmingCheckin(true)}
                />
            )}

            <ConfirmDialog isOpen={isWarningCheckout} title="¡Atención! Herramientas por vencer"
                message={`Este carro contiene herramientas con controles vencidos o por vencer. ¿Autorizas la salida de todas formas?`}
                onConfirm={() => { setIsWarningCheckout(false); setIsConfirmingCheckout(true); }}
                onCancel={() => setIsWarningCheckout(false)} confirmLabel="Autorizar" variant="warning" />
            
            <ConfirmDialog isOpen={isConfirmingCheckout} title="Confirmar Salida"
                message={`¿Confirmas el retiro de ${selectedCart?.nombre}?`}
                onConfirm={submitCheckout} onCancel={() => setIsConfirmingCheckout(false)} confirmLabel="Registrar" variant="info" />
            <ConfirmDialog isOpen={isConfirmingCheckin} title="Confirmar Devolución"
                message={`¿Confirmas que devuelves ${selectedMovement?.cart?.nombre || selectedMovement?.carro?.nombre}?`}
                onConfirm={submitCheckin} onCancel={() => setIsConfirmingCheckin(false)} confirmLabel="Devolver" variant="info" />
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: VERIFICACIÓN — Escanear QR → visualizar/verificar
// ═══════════════════════════════════════════════════════════════════════════════
function VerificacionTab({ user }: { user: any }) {
    const [isScanning, setIsScanning] = useState(false);
    const [manualId, setManualId] = useState('');
    const [tool, setTool] = useState<Tool | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [verifyMode, setVerifyMode] = useState(false);
    const [warningCartModal, setWarningCartModal] = useState<Tool | null>(null);

    const handleScan = (text: string) => {
        setIsScanning(false);
        let id = text;
        if (text.startsWith('TOOL:')) id = text.split(':')[1];
        else if (text.startsWith('TOOLCART:')) id = text.split(':')[1];
        loadTool(id);
    };

    const loadTool = async (id: string) => {
        setIsLoading(true);
        setTool(null);
        try {
            const res = await safeApiRequest(`/api/herramientas/${id}`);
            if (!res.ok) { showToast('Herramienta no encontrada', 'error'); return; }
            const fetchedTool = await res.json();
            
            if (fetchedTool.tipo === 'CARRO' && fetchedTool.herramientas) {
                const hasExpired = fetchedTool.herramientas.some((h: any) => h.estadoControl === 'VENCIDO' || h.estadoControl === 'POR_VENCER');
                if (hasExpired && warningCartModal?.id !== fetchedTool.id) {
                    setWarningCartModal(fetchedTool);
                    return;
                }
            }
            
            setTool(fetchedTool);
        } catch (e) { showToast('Error de conexión', 'error'); }
        finally { setIsLoading(false); }
    };

    const handleVerify = async (estado: 'APROBADA' | 'RECHAZADA') => {
        if (!tool) return;
        try {
            const res = await safeApiRequest('/api/herramientas/verificar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ toolId: tool.id, operadorId: user.id, operadorNombre: user.nombreCompleto, estado })
            });
            if (!res.ok) { const e = await res.json(); showToast(e.error || 'Error', 'error'); return; }
            showToast(`Herramienta ${estado.toLowerCase()}`, 'success');
            loadTool(tool.id);
            setVerifyMode(false);
        } catch (e) { showToast('Error de conexión', 'error'); }
    };

    return (
        <div className="max-w-lg mx-auto space-y-6">
            {/* Scan Controls */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 text-center">
                <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4">
                    <ShieldCheck className="w-8 h-8" />
                </div>
                <h2 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-2">Verificación de Herramientas</h2>
                <p className="text-xs text-slate-500 mb-6 font-medium">Escanea el QR de una herramienta para visualizar o verificar su estado.</p>
                <button onClick={() => setIsScanning(true)}
                    className="w-full py-3.5 bg-emerald-600 text-white rounded-2xl font-black text-sm hover:bg-emerald-500 transition-all flex items-center justify-center gap-2 active:scale-95 shadow-md">
                    <Camera className="w-5 h-5" /> Escanear QR
                </button>
                <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">O ingresa el ID</p>
                    <div className="flex gap-2">
                        <input type="text" placeholder="ID de herramienta" value={manualId}
                            onChange={e => setManualId(e.target.value)}
                            className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:border-primary" />
                        <button onClick={() => { if (manualId.trim()) loadTool(manualId.trim()); }} disabled={!manualId}
                            className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-4 rounded-xl disabled:opacity-50">
                            <Search className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {isScanning && <ScannerModal onScan={handleScan} onClose={() => setIsScanning(false)} />}

            <ConfirmDialog
                isOpen={!!warningCartModal}
                title="¡Atención! Herramientas por vencer"
                message={`El carro que escaneaste contiene herramientas con controles vencidos o por vencer. Te sugerimos revisar la lista.`}
                onConfirm={() => { setTool(warningCartModal); setWarningCartModal(null); }}
                onCancel={() => setWarningCartModal(null)}
                confirmLabel="Ver Detalles"
                cancelLabel="Cerrar"
                variant="warning"
            />

            {isLoading && (
                <div className="flex justify-center py-8"><div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>
            )}

            {/* Tool Detail */}
            {tool && (
                <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 animate-in slide-in-from-bottom-4 duration-300 space-y-4">
                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">{tool.nombre}</h3>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 font-mono mt-1">ID: {tool.id}</p>
                        </div>
                        <button onClick={() => setTool(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-slate-400"><X className="w-5 h-5" /></button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="bg-slate-50 dark:bg-slate-900/30 p-3 rounded-xl"><span className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Tipo</span><span className="font-bold text-slate-700 dark:text-slate-200">{tool.tipo}</span></div>
                        {tool.marca && <div className="bg-slate-50 dark:bg-slate-900/30 p-3 rounded-xl"><span className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Marca</span><span className="font-bold text-slate-700 dark:text-slate-200">{tool.marca}</span></div>}
                        {tool.subtipo && <div className="bg-slate-50 dark:bg-slate-900/30 p-3 rounded-xl"><span className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Subtipo</span><span className="font-bold text-slate-700 dark:text-slate-200">{tool.subtipo}</span></div>}
                        {tool.rubro && <div className="bg-slate-50 dark:bg-slate-900/30 p-3 rounded-xl"><span className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Rubro</span><span className="font-bold text-slate-700 dark:text-slate-200">{tool.rubro}</span></div>}
                    </div>

                    {tool.controlActivo && (
                        <div className="space-y-2 bg-slate-50 dark:bg-slate-900/30 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                            <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2"><ShieldCheck className="w-3.5 h-3.5" /> Control</h4>
                            {tool.estadoControl && (
                                <div className={`inline-block text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg ${ESTADO_CONTROL_STYLES[tool.estadoControl]?.cls}`}>
                                    {ESTADO_CONTROL_STYLES[tool.estadoControl]?.label}
                                    {tool.diasRestantes !== null && <span className="ml-1">({tool.diasRestantes}d)</span>}
                                </div>
                            )}
                            {tool.estadoHerramienta && <p className="text-xs font-bold text-slate-500">Estado: <span className={`font-black ${tool.estadoHerramienta === 'APROBADA' ? 'text-emerald-600' : 'text-red-600'}`}>{tool.estadoHerramienta}</span></p>}
                            {tool.ultimoControlOperador && <p className="text-xs font-bold text-slate-500">Último control por: {tool.ultimoControlOperador}</p>}
                            {tool.ultimoControlFecha && <p className="text-xs font-bold text-slate-500">Fecha: {new Date(tool.ultimoControlFecha).toLocaleDateString('es-AR')}</p>}
                            {tool.proximoControlFecha && <p className="text-xs font-bold text-slate-500">Próxima verificación: <span className="text-slate-700 dark:text-slate-300 font-black">{new Date(tool.proximoControlFecha).toLocaleDateString('es-AR')}</span></p>}

                            {/* Verify Actions */}
                            {!verifyMode ? (
                                <button onClick={() => setVerifyMode(true)}
                                    className="w-full mt-2 py-3 bg-primary text-white rounded-xl font-black text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-all">
                                    <ShieldCheck className="w-4 h-4" /> Verificar Ahora
                                </button>
                            ) : (
                                <div className="flex gap-2 mt-2 animate-in fade-in duration-200">
                                    <button onClick={() => handleVerify('APROBADA')}
                                        className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-black text-sm flex items-center justify-center gap-2 hover:bg-emerald-500 transition-all active:scale-95">
                                        <CheckCircle2 className="w-4 h-4" /> Aprobada
                                    </button>
                                    <button onClick={() => handleVerify('RECHAZADA')}
                                        className="flex-1 py-3 bg-red-600 text-white rounded-xl font-black text-sm flex items-center justify-center gap-2 hover:bg-red-500 transition-all active:scale-95">
                                        <X className="w-4 h-4" /> Rechazada
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Verification History */}
                    {tool.verificaciones && tool.verificaciones.length > 0 && (
                        <div className="space-y-2">
                            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Historial de Verificaciones</h4>
                            {tool.verificaciones.map((v: any) => (
                                <div key={v.id} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50/50 dark:bg-slate-900/20">
                                    <div className="flex items-center gap-2">
                                        {v.estado === 'APROBADA' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <X className="w-3.5 h-3.5 text-red-500" />}
                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{v.operadorNombre}</span>
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-400">{new Date(v.fecha).toLocaleDateString('es-AR')}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Cargo content lists for CARRO types */}
                    {tool.tipo === 'CARRO' && tool.herramientas && tool.herramientas.length > 0 && (
                        <div className="space-y-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                            {(() => {
                                const conControl = tool.herramientas.filter((h: any) => h.controlActivo);
                                const sinControl = tool.herramientas.filter((h: any) => !h.controlActivo);
                                
                                return (
                                    <>
                                        {conControl.length > 0 && (
                                            <div className="space-y-3">
                                                <h4 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                                    <ShieldCheck className="w-4 h-4" /> Herramientas Sujetas a Control ({conControl.length})
                                                </h4>
                                                <div className="space-y-2.5">
                                                    {conControl.map((h: any) => (
                                                        <div key={h.id} className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
                                                            <div className="flex justify-between items-start mb-2 gap-3">
                                                                <div className="flex-1">
                                                                    <span className="text-sm font-black text-slate-800 dark:text-slate-100 block leading-tight">{h.nombre}</span>
                                                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 font-mono mt-1 block">ID: {h.id}</span>
                                                                </div>
                                                                {h.estadoControl && (
                                                                    <div className={`shrink-0 whitespace-nowrap text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg ${ESTADO_CONTROL_STYLES[h.estadoControl]?.cls || ''}`}>
                                                                        {ESTADO_CONTROL_STYLES[h.estadoControl]?.label}
                                                                        {h.diasRestantes !== null && <span className="ml-1">({h.diasRestantes}d)</span>}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 space-y-1.5 mt-2 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl">
                                                                {h.estadoHerramienta && (
                                                                    <div className="flex justify-between">
                                                                        <span>Estado Actual:</span>
                                                                        <span className={`font-black ${h.estadoHerramienta === 'APROBADA' ? 'text-emerald-600' : 'text-red-600'}`}>{h.estadoHerramienta}</span>
                                                                    </div>
                                                                )}
                                                                <div className="flex justify-between">
                                                                    <span>Último control:</span>
                                                                    <span className="font-bold text-slate-700 dark:text-slate-300 text-right">
                                                                        {h.ultimoControlFecha ? `${new Date(h.ultimoControlFecha).toLocaleDateString('es-AR')}` : 'Nunca'}
                                                                        {h.ultimoControlOperador ? ` por ${h.ultimoControlOperador}` : ''}
                                                                    </span>
                                                                </div>
                                                                {h.proximoControlFecha && (
                                                                    <div className="flex justify-between">
                                                                        <span>Próxima verificación:</span>
                                                                        <span className="font-black text-slate-800 dark:text-slate-200">{new Date(h.proximoControlFecha).toLocaleDateString('es-AR')}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {sinControl.length > 0 && (
                                            <div className="space-y-3 pt-2">
                                                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                                    <Wrench className="w-4 h-4" /> Otras Herramientas ({sinControl.length})
                                                </h4>
                                                <div className="space-y-2">
                                                    {sinControl.map((h: any) => (
                                                        <div key={h.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex justify-between items-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                                            <span className="text-sm font-black text-slate-700 dark:text-slate-300 truncate">{h.nombre}</span>
                                                            <span className="shrink-0 ml-2 text-[10px] font-black text-slate-400 font-mono">ID: {h.id}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: HISTORIAL — Movement history (migrado de /carros-historial)
// ═══════════════════════════════════════════════════════════════════════════════
function HistorialTab({ user }: { user: any }) {
    const [movements, setMovements] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedMovements, setExpandedMovements] = useState<Set<string>>(new Set());

    useEffect(() => { loadMovements(); }, []);

    const loadMovements = async () => {
        setIsLoading(true);
        try {
            const res = await safeApiRequest('/api/carros/movements/history');
            if (res.ok) setMovements(await res.json());
        } catch (e) { console.error(e); }
        finally { setIsLoading(false); }
    };

    const toggleExpand = (id: string) => {
        setExpandedMovements(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const totalMovements = movements.length;
    const activeCount = movements.filter(m => m.estado === 'ACTIVO').length;
    const withMissing = movements.filter(m => m.items?.some((i: any) => {
        if (m.estado === 'COMPLETADO') return (i.cantidadIn ?? 0) < i.cantidad;
        return (i.cantidadOut ?? 0) < i.cantidad;
    })).length;

    return (
        <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 text-center">
                    <p className="text-2xl font-black text-slate-800 dark:text-slate-100">{totalMovements}</p>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1">Movimientos</p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 text-center">
                    <p className="text-2xl font-black text-blue-600">{activeCount}</p>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1">En Uso</p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 text-center">
                    <p className="text-2xl font-black text-red-500">{withMissing}</p>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1">Con Faltantes</p>
                </div>
            </div>

            {/* Movement List */}
            {isLoading ? (
                <div className="flex justify-center py-16"><div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>
            ) : movements.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-12 text-center border border-slate-200 dark:border-slate-700">
                    <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm font-bold text-slate-500">No hay movimientos registrados.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {movements.map(mov => {
                        const isActive = mov.estado === 'ACTIVO';
                        const isExpanded = expandedMovements.has(mov.id);
                        const hasMissing = mov.items?.some((i: any) => isActive ? (i.cantidadOut ?? 0) < i.cantidad : (i.cantidadIn ?? 0) < i.cantidad);
                        return (
                            <div key={mov.id} className={`bg-white dark:bg-slate-800 rounded-2xl shadow-sm border transition-all ${hasMissing ? 'border-red-200 dark:border-red-800' : 'border-slate-200 dark:border-slate-700'}`}>
                                <button type="button" onClick={() => toggleExpand(mov.id)} className="w-full p-5 text-left">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-black text-slate-800 dark:text-slate-100 text-base">{mov.cart?.nombre || mov.carro?.nombre}</span>
                                                <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${isActive ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'}`}>{isActive ? 'En Uso' : 'Devuelto'}</span>
                                                {hasMissing && <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Faltantes</span>}
                                            </div>
                                            <p className="text-xs font-medium text-slate-500 mt-1">
                                                <span className="font-bold text-slate-600 dark:text-slate-300">{mov.operator?.nombreCompleto}</span> → {mov.project?.nombre}
                                            </p>
                                            <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5">
                                                <span className="text-[10px] font-bold text-slate-400">Salida: {new Date(mov.fechaSalida).toLocaleDateString('es-AR')}</span>
                                                <span className="text-[10px] font-bold text-slate-400">Devolución: {mov.fechaDevolucion ? new Date(mov.fechaDevolucion).toLocaleDateString('es-AR') : '—'}</span>
                                            </div>
                                        </div>
                                        {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                                    </div>
                                </button>
                                {isExpanded && (
                                    <div className="px-5 pb-5 pt-0 border-t border-slate-100 dark:border-slate-800 animate-in slide-in-from-top-2 duration-200">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 mt-4">Herramientas</p>
                                        <div className="space-y-2">
                                            {mov.items?.map((item: any) => {
                                                const missingOut = (item.cantidadOut ?? 0) < item.cantidad;
                                                const missingIn = mov.estado === 'COMPLETADO' && (item.cantidadIn ?? 0) < item.cantidad;
                                                const isMissing = missingOut || missingIn;
                                                return (
                                                    <div key={item.id} className={`p-3 rounded-xl text-xs flex items-start gap-3 ${isMissing ? 'bg-red-50 dark:bg-red-900/15 border border-red-200 dark:border-red-800' : 'bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-700'}`}>
                                                        {isMissing ? <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" /> : <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />}
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-black text-slate-800 dark:text-slate-100 break-words">{item.nombre}
                                                                {item.isAdditional && <span className="ml-1 text-[9px] font-bold text-blue-500">(adicional)</span>}
                                                            </p>
                                                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[10px] font-bold text-slate-500">
                                                                <span>Esperado: {item.cantidad}</span>
                                                                <span>Salida: <span className={missingOut ? 'text-red-500' : ''}>{item.cantidadOut}</span></span>
                                                                {mov.estado === 'COMPLETADO' && <span>Devolución: <span className={missingIn ? 'text-red-500' : ''}>{item.cantidadIn ?? '—'}</span></span>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════
function ScannerModal({ onScan, onClose }: { onScan: (text: string) => void, onClose: () => void }) {
    useEffect(() => {
        const html5QrCode = new Html5Qrcode("reader");
        const config = { fps: 10, qrbox: { width: 250, height: 250 } };
        html5QrCode.start({ facingMode: "environment" }, config,
            (decodedText) => { onScan(decodedText); html5QrCode.stop().catch(() => {}); },
            () => {}
        ).catch(err => {
            console.error(err);
            showToast("Error al iniciar cámara. Verifica los permisos.", "error");
            onClose();
        });
        return () => { if (html5QrCode.isScanning) html5QrCode.stop().catch(() => {}); };
    }, [onScan, onClose]);

    return (
        <div className="fixed inset-0 z-[200] bg-slate-900/90 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl space-y-4">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2"><Camera className="w-5 h-5 text-primary" /> Escaneando QR</h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-400"><X className="w-6 h-6" /></button>
                </div>
                <div className="relative aspect-square bg-slate-900">
                    <div id="reader" className="w-full h-full" />
                    <div className="absolute inset-0 border-[40px] border-slate-900/40 pointer-events-none flex items-center justify-center">
                        <div className="w-full h-full border-2 border-primary/50 rounded-2xl shadow-[0_0_0_999px_rgba(15,23,42,0.6)]" />
                    </div>
                </div>
                <div className="p-6 text-center">
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Apunta la cámara al código QR</p>
                </div>
            </div>
            <button onClick={onClose} className="mt-8 px-8 py-3 bg-white/10 hover:bg-white/20 text-white rounded-full font-black uppercase tracking-widest text-[10px] transition-all">
                Cancelar Escaneo
            </button>
        </div>
    );
}

function CheckoutCheckinView({
    type, title, subtitle, checklist, updateToolQty, projects, selectedProjectId, setSelectedProjectId,
    newToolName, setNewToolName, newToolQty, setNewToolQty, handleAddNewTool,
    missingCount, isLoading, onBack, onSubmit
}: any) {
    const isCheckout = type === 'checkout';
    return (
        <div className="space-y-6 animate-in slide-in-from-right-8 duration-300">
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h2 className="text-xl font-black text-slate-800 dark:text-slate-100">{title}</h2>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">{isCheckout ? 'Checklist de Salida' : 'Devolución de Carro'}</p>
                        {subtitle && <p className="text-xs font-medium text-slate-500 mt-2">{subtitle}</p>}
                    </div>
                    <button onClick={onBack} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-slate-400"><ArrowLeft className="w-5 h-5" /></button>
                </div>

                {isCheckout && projects && (
                    <div className="mb-6">
                        <SearchableSelect label="Proyecto de Destino" options={projects.map((p: any) => ({ id: p.id, label: p.nombre }))}
                            value={selectedProjectId} onChange={setSelectedProjectId} />
                    </div>
                )}

                <p className="text-xs text-slate-500 font-medium mb-4">Ingresa la cantidad que {isCheckout ? 'encuentras' : 'devuelves'} de cada herramienta.</p>

                <div className="space-y-3 mb-6">
                    {checklist.map((item: any) => {
                        const value = isCheckout ? (item.cantidadOut || 0) : (item.cantidadIn || 0);
                        const missingCount = Math.max(0, item.cantidad - value);
                        return (
                            <div key={item.id} className="p-4 rounded-2xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 space-y-3">
                                <div>
                                    <span className="text-sm font-black text-slate-800 dark:text-slate-100 block break-words">{item.nombre}</span>
                                    <span className="text-[10px] uppercase tracking-widest font-black text-slate-400">Esperado: {item.cantidad}</span>
                                </div>
                                <div className="flex items-center justify-center gap-2">
                                    <button type="button" onClick={() => updateToolQty(item.id, value - 1, isCheckout)}
                                        className="w-11 h-11 flex items-center justify-center bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 active:scale-90 transition-transform">
                                        <Minus className="w-4 h-4" />
                                    </button>
                                    <input type="number" min={0} max={item.cantidad} value={value}
                                        onChange={e => updateToolQty(item.id, parseInt(e.target.value) || 0, isCheckout)}
                                        className="w-16 h-11 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-center text-base font-black text-slate-800 dark:text-slate-100 outline-none focus:border-primary" />
                                    <button type="button" disabled={value >= item.cantidad}
                                        onClick={() => updateToolQty(item.id, value + 1, isCheckout)}
                                        className="w-11 h-11 flex items-center justify-center bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 disabled:opacity-30 active:scale-90 transition-transform">
                                        <Plus className="w-4 h-4" />
                                    </button>
                                </div>
                                {missingCount > 0 && (
                                    <div className="flex items-center gap-1.5 text-red-500 animate-in fade-in slide-in-from-top-1">
                                        <AlertTriangle className="w-3.5 h-3.5" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Faltan {missingCount} unidades</span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {isCheckout && handleAddNewTool && (
                    <div className="flex gap-2 p-1 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <input type="text" placeholder="Agregar adicional..." value={newToolName}
                            onChange={(e: any) => setNewToolName(e.target.value)}
                            className="flex-1 bg-transparent px-4 py-3 text-xs font-bold outline-none min-w-0" />
                        <input type="number" min={1} value={newToolQty}
                            onChange={(e: any) => setNewToolQty(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-14 bg-transparent border-x border-slate-200 dark:border-slate-700 text-xs font-black text-center outline-none" />
                        <button type="button" onClick={handleAddNewTool} disabled={!newToolName?.trim()} className="px-4 text-primary disabled:opacity-30">
                            <Plus className="w-5 h-5" />
                        </button>
                    </div>
                )}
            </div>

            {missingCount > 0 && (
                <div className={`${isCheckout ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' : 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800'} border rounded-2xl p-4 flex gap-3 animate-in fade-in`}>
                    <AlertTriangle className={`w-5 h-5 ${isCheckout ? 'text-amber-500' : 'text-rose-500'} shrink-0`} />
                    <p className={`text-xs font-bold ${isCheckout ? 'text-amber-800 dark:text-amber-400' : 'text-rose-800 dark:text-rose-400'} leading-tight`}>
                        Se reportarán discrepancias en {missingCount} herramientas.
                    </p>
                </div>
            )}

            <button type="button" disabled={isLoading || (isCheckout && !selectedProjectId)} onClick={onSubmit}
                className={`w-full py-4 ${isCheckout ? 'bg-primary shadow-xl shadow-primary/20' : 'bg-slate-800 dark:bg-slate-100 dark:text-slate-900'} text-white rounded-2xl font-black uppercase tracking-widest text-sm disabled:opacity-50 flex items-center justify-center gap-2`}>
                {isCheckout ? <><ClipboardCheck className="w-5 h-5" /> Confirmar Salida</> : 'Finalizar y Entregar Carro'}
            </button>
        </div>
    );
}
