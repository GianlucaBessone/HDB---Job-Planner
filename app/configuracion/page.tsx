'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    Settings,
    Tags,
    ListChecks,
    Folders,
    Plus,
    Trash2,
    Edit2,
    Save,
    X,
    Bell,
    Play,
    MapPin,
    Clock, 
    Shield, 
    CheckCircle2, 
    AlertTriangle, 
    Loader2, 
    ExternalLink, 
    Globe, 
    History,
    FileText,
    QrCode,
    Wrench,
    Eye
} from 'lucide-react';
import MapPicker from '@/components/MapPicker';
import ConfirmDialog from '@/components/ConfirmDialog';
import { showToast } from '@/components/Toast';
import { safeApiRequest } from '@/lib/offline';
import { QRCodeCanvas } from 'qrcode.react';
import { ViewConfig, DEFAULT_VIEWS, getViewConfig } from '@/lib/viewAccess';

export default function ConfigPage() {
    const router = useRouter();
    const [userRole, setUserRole] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'tags' | 'checklists' | 'options' | 'os' | 'system' | 'vistas'>('tags');

    useEffect(() => {
        const stored = localStorage.getItem('currentUser');
        if (stored) {
            try {
                const user = JSON.parse(stored);
                const role = user.role?.toLowerCase();
                if (role !== 'admin' && role !== 'supervisor') {
                    router.replace('/');
                } else {
                    setUserRole(role);
                }
            } catch (e) {
                router.replace('/');
            }
        } else {
            router.replace('/');
        }
    }, [router]);

    if (!userRole) return <ConfigSkeleton />;

    return (
        <div className="w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <div className="space-y-1">
                    <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight flex items-center gap-2 md:gap-3">
                        <Settings className="w-6 h-6 md:w-8 md:h-8 text-slate-700 dark:text-slate-200" />
                        Configuración
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium hidden md:block">Administra catálogos y valores globales del sistema</p>
                </div>
            </div>

            <div className="flex border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
                <button
                    onClick={() => setActiveTab('tags')}
                    className={`flex items-center gap-1.5 px-4 md:px-6 py-3 md:py-4 text-xs md:text-sm font-bold uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${activeTab === 'tags' ? 'border-primary text-primary' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'}`}
                >
                    <Tags className="w-4 h-4" />
                    Etiquetas
                </button>
                <button
                    onClick={() => setActiveTab('checklists')}
                    className={`flex items-center gap-1.5 px-4 md:px-6 py-3 md:py-4 text-xs md:text-sm font-bold uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${activeTab === 'checklists' ? 'border-primary text-primary' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'}`}
                >
                    <ListChecks className="w-4 h-4" />
                    Checklists
                </button>
                <button
                    onClick={() => setActiveTab('options')}
                    className={`flex items-center gap-1.5 px-4 md:px-6 py-3 md:py-4 text-xs md:text-sm font-bold uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${activeTab === 'options' ? 'border-primary text-primary' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'}`}
                >
                    <Folders className="w-4 h-4" />
                    Desplegables
                </button>
                <button
                    onClick={() => setActiveTab('system')}
                    className={`flex items-center gap-1.5 px-4 md:px-6 py-3 md:py-4 text-xs md:text-sm font-bold uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${activeTab === 'system' ? 'border-primary text-primary' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'}`}
                >
                    <Bell className="w-4 h-4" />
                    Sistema
                </button>
                <button
                    onClick={() => setActiveTab('os')}
                    className={`flex items-center gap-1.5 px-4 md:px-6 py-3 md:py-4 text-xs md:text-sm font-bold uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${activeTab === 'os' ? 'border-primary text-primary' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'}`}
                >
                    <FileText className="w-4 h-4" />
                    Ordenes de Servicio
                </button>
                <button
                    onClick={() => setActiveTab('vistas')}
                    className={`flex items-center gap-1.5 px-4 md:px-6 py-3 md:py-4 text-xs md:text-sm font-bold uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${activeTab === 'vistas' ? 'border-primary text-primary' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'}`}
                >
                    <Eye className="w-4 h-4" />
                    Vistas
                </button>
            </div>

            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 min-h-[400px] rounded-[2rem] p-6 md:p-8 shadow-sm">
                {activeTab === 'tags' && <TagsSection />}
                {activeTab === 'checklists' && <ChecklistSection />}
                {activeTab === 'options' && <OptionsSection />}
                {activeTab === 'system' && <SystemSection />}
                {activeTab === 'os' && <OSSection />}
                {activeTab === 'vistas' && <ViewsSection />}
            </div>
        </div>
    );
}

// ----- OS SECTION -----
function OSSection() {
    const [setting, setSetting] = useState({
        valorManoObra: 0,
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        safeApiRequest('/api/config/system')
            .then(res => res.json())
            .then(data => { setSetting({ valorManoObra: data.valorManoObra || 0 }); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    const handleSave = async () => {
        setSaving(true);
        // Get existing settings first to not overwrite other system settings
        const currentRes = await safeApiRequest('/api/config/system');
        if (!currentRes.ok) throw new Error();
        const currentData = await currentRes.json();
        
        await safeApiRequest('/api/config/system', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...currentData, valorManoObra: setting.valorManoObra })
        });
        setSaving(false);
        showToast('Configuración de OS guardada correctamente.', 'success');
    };

    if (loading) return <div>Cargando...</div>;

    return (
        <div className="space-y-6 max-w-lg">
            <div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Órdenes de Servicio</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Configuración de valores para facturación y reportes de OS.</p>
            </div>

            <div className="space-y-4 bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div>
                    <h4 className="font-bold text-slate-800 dark:text-slate-100">Valor de Mano de Obra (por hora)</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Utilizado como valor predeterminado al generar documentos de cobro para Órdenes de Servicio.
                    </p>
                </div>
                <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400 dark:text-slate-500">$</span>
                    <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={setting.valorManoObra}
                        onChange={e => setSetting({ ...setting, valorManoObra: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 pl-8 pr-4 outline-none font-bold text-slate-700 dark:text-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                        placeholder="Ej: 50.00"
                    />
                </div>
            </div>

            <button
                onClick={handleSave}
                disabled={saving}
                className="w-full mt-4 bg-primary text-white font-bold rounded-xl py-3 hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-50"
            >
                {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
        </div>
    );
}

function ConfigSkeleton() {
    return (
        <div className="w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <div className="space-y-1">
                    <h2 className="text-2xl flex items-center gap-2"><div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse"></div> <div className="w-40 h-8 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div></h2>
                    <div className="w-64 h-4 bg-slate-100 dark:bg-slate-800/50 rounded animate-pulse mt-2"></div>
                </div>
            </div>
            <div className="flex border-b border-slate-200 dark:border-slate-700 overflow-x-auto gap-4 py-2">
                <div className="w-24 h-6 bg-slate-200/60 rounded animate-pulse"></div>
                <div className="w-24 h-6 bg-slate-200/60 rounded animate-pulse"></div>
                <div className="w-24 h-6 bg-slate-200/60 rounded animate-pulse"></div>
            </div>
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 min-h-[400px] rounded-[2rem] p-6 md:p-8 shadow-sm flex flex-col gap-4">
                <div className="w-1/3 h-8 bg-slate-200/50 rounded animate-pulse mb-4"></div>
                {Array(3).fill(0).map((_, i) => <div key={i} className="w-full h-16 bg-slate-100/50 rounded-xl animate-pulse"></div>)}
            </div>
        </div>
    );
}

// ----- TAGS SECTION -----
function TagsSection() {
    const [tags, setTags] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState({ name: '', active: true, impactsMetrics: false });

    // Confirm dialog
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);

    useEffect(() => { loadTags(); }, []);

    const loadTags = () => {
        setLoading(true);
        safeApiRequest('/api/config/tags')
            .then(res => res.json())
            .then(data => { setTags(Array.isArray(data) ? data : []); setLoading(false); })
            .catch(() => setLoading(false));
    };

    const handleSave = async (id?: string) => {
        if (!form.name.trim()) return;
        const method = id ? 'PUT' : 'POST';
        const body = id ? { id, ...form } : form;

        await safeApiRequest('/api/config/tags', {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        setEditingId(null);
        setForm({ name: '', active: true, impactsMetrics: false });
        loadTags();
    };

    const handleDelete = async (id: string) => {
        setItemToDelete(id);
        setIsConfirmOpen(true);
    };

    const confirmDelete = async () => {
        if (!itemToDelete) return;
        await safeApiRequest(`/api/config/tags?id=${itemToDelete}`, { method: 'DELETE' });
        setIsConfirmOpen(false);
        setItemToDelete(null);
        loadTags();
    };

    if (loading) return <div>Cargando...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Etiquetas de Proyectos</h3>
                <button
                    onClick={() => setEditingId('new')}
                    className="flex items-center gap-2 bg-primary/10 text-primary hover:bg-primary hover:text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors"
                >
                    <Plus className="w-4 h-4" /> Nueva Etiqueta
                </button>
            </div>

            <div className="space-y-3">
                {editingId === 'new' && (
                    <div className="flex flex-col gap-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-primary/20">
                        <div className="flex flex-col md:flex-row md:items-center gap-4">
                            <input
                                className="w-full md:flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm font-semibold"
                                placeholder="Nombre de la etiqueta"
                                value={form.name}
                                onChange={e => setForm({ ...form, name: e.target.value })}
                            />
                            <div className="flex items-center gap-6 flex-wrap px-1">
                                <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 font-bold cursor-pointer">
                                    <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} className="w-4 h-4 rounded text-primary focus:ring-primary" />
                                    Activo
                                </label>
                                <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 font-bold cursor-pointer">
                                    <input type="checkbox" checked={form.impactsMetrics} onChange={e => setForm({ ...form, impactsMetrics: e.target.checked })} className="w-4 h-4 rounded text-primary focus:ring-primary" />
                                    Impacta Métricas
                                </label>
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800 pt-3">
                            <button onClick={() => handleSave()} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors"><Save className="w-4 h-4" /> Guardar</button>
                            <button onClick={() => setEditingId(null)} className="flex items-center gap-2 px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-300 transition-colors"><X className="w-4 h-4" /> Cancelar</button>
                        </div>
                    </div>
                )}

                {tags.map(tag => (
                    editingId === tag.id ? (
                        <div key={tag.id} className="flex flex-col gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-primary/20 shadow-lg">
                            <div className="flex flex-col md:flex-row md:items-center gap-4">
                                <input
                                    className="w-full md:flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm font-semibold"
                                    value={form.name}
                                    onChange={e => setForm({ ...form, name: e.target.value })}
                                />
                                <div className="flex items-center gap-6 flex-wrap px-1">
                                    <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 font-bold cursor-pointer">
                                        <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} className="w-4 h-4 rounded text-primary focus:ring-primary" />
                                        Activo
                                    </label>
                                    <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 font-bold cursor-pointer">
                                        <input type="checkbox" checked={form.impactsMetrics} onChange={e => setForm({ ...form, impactsMetrics: e.target.checked })} className="w-4 h-4 rounded text-primary focus:ring-primary" />
                                        Impacta Métricas
                                    </label>
                                </div>
                            </div>
                            <div className="flex items-center justify-end gap-3 border-t border-slate-50 pt-3">
                                <button onClick={() => handleSave(tag.id)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors"><Save className="w-4 h-4" /> Guardar</button>
                                <button onClick={() => setEditingId(null)} className="flex items-center gap-2 px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-300 transition-colors"><X className="w-4 h-4" /> Cancelar</button>
                            </div>
                        </div>
                    ) : (
                        <div key={tag.id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/50 hover:bg-white dark:hover:bg-slate-800 p-4 rounded-xl border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all">
                            <div className="flex items-center gap-4">
                                <span className="font-bold text-slate-800 dark:text-slate-100">{tag.name}</span>
                                {!tag.active && <span className="px-2 py-0.5 bg-rose-100 text-rose-600 text-[10px] uppercase font-black tracking-widest rounded-md">Inactivo</span>}
                                {tag.impactsMetrics && <span className="px-2 py-0.5 bg-indigo-100 text-indigo-600 text-[10px] uppercase font-black tracking-widest rounded-md">Métricas</span>}
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => { setEditingId(tag.id); setForm({ name: tag.name, active: tag.active, impactsMetrics: tag.impactsMetrics }); }} className="btn-icon-inline text-slate-400 dark:text-slate-500 hover:text-primary p-2 transition-colors"><Edit2 className="w-4 h-4" /></button>
                                <button onClick={() => handleDelete(tag.id)} className="btn-icon-inline text-slate-400 dark:text-slate-500 hover:text-rose-500 p-2 transition-colors"><Trash2 className="w-4 h-4" /></button>
                            </div>
                        </div>
                    )
                ))}
            </div>

            <ConfirmDialog
                isOpen={isConfirmOpen}
                title="¿Eliminar etiqueta?"
                message="Esta acción no se puede deshacer y puede afectar a los proyectos que la utilicen."
                onConfirm={confirmDelete}
                onCancel={() => setIsConfirmOpen(false)}
            />
        </div>
    );
}

// ----- CHECKLIST SECTION -----
function ChecklistSection() {
    const [tags, setTags] = useState<any[]>([]);
    const [selectedTag, setSelectedTag] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState({ description: '', active: true, order: 0 });

    // Confirm dialog
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);

    useEffect(() => { loadTags(); }, []);

    const loadTags = () => {
        setLoading(true);
        safeApiRequest('/api/config/tags')
            .then(res => res.json())
            .then(data => { setTags(Array.isArray(data) ? data : []); setLoading(false); })
            .catch(() => setLoading(false));
    };

    const handleSave = async (id?: string) => {
        if (!form.description.trim() || !selectedTag) return;
        const method = id ? 'PUT' : 'POST';
        const body = id ? { id, tagId: selectedTag, ...form } : { tagId: selectedTag, ...form };

        await safeApiRequest('/api/config/checklists', {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        setEditingId(null);
        setForm({ description: '', active: true, order: 0 });
        loadTags();
    };

    const handleDelete = async (id: string) => {
        setItemToDelete(id);
        setIsConfirmOpen(true);
    };

    const confirmDelete = async () => {
        if (!itemToDelete) return;
        await safeApiRequest(`/api/config/checklists?id=${itemToDelete}`, { method: 'DELETE' });
        setIsConfirmOpen(false);
        setItemToDelete(null);
        loadTags();
    };

    const currentTag = tags.find(t => t.id === selectedTag);
    const checklists = currentTag?.checklists || [];
    // Sort checklists by order, then by creation
    checklists.sort((a: any, b: any) => a.order - b.order);

    if (loading) return <div>Cargando...</div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Checklist por Etiqueta</h3>
                <select
                    className="px-4 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-primary/20"
                    value={selectedTag}
                    onChange={e => setSelectedTag(e.target.value)}
                >
                    <option value="">-- Seleccionar Etiqueta --</option>
                    {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
            </div>

            {selectedTag && (
                <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <button
                        onClick={() => { setEditingId('new'); setForm({ description: '', active: true, order: checklists.length }); }}
                        className="flex items-center gap-2 bg-primary/10 text-primary hover:bg-primary hover:text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors w-full justify-center mb-6"
                    >
                        <Plus className="w-4 h-4" /> Agregar Ítem de Checklist
                    </button>

                    {editingId === 'new' && (
                        <div className="flex flex-col gap-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-primary/20">
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                                <input
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm font-semibold"
                                    type="number" placeholder="Orden"
                                    value={form.order} onChange={e => setForm({ ...form, order: Number(e.target.value) })}
                                />
                                <input
                                    className="w-full sm:col-span-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm font-semibold"
                                    placeholder="Descripción del ítem"
                                    value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                                />
                                <div className="flex items-center px-1">
                                    <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 font-bold cursor-pointer">
                                        <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} className="w-4 h-4 rounded text-primary focus:ring-primary" />
                                        Activo
                                    </label>
                                </div>
                            </div>
                            <div className="flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800 pt-3">
                                <button onClick={() => handleSave()} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors"><Save className="w-4 h-4" /> Guardar</button>
                                <button onClick={() => setEditingId(null)} className="flex items-center gap-2 px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-300 transition-colors"><X className="w-4 h-4" /> Cancelar</button>
                            </div>
                        </div>
                    )}

                    {checklists.map((item: any) => (
                        editingId === item.id ? (
                            <div key={item.id} className="flex flex-col gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-primary/20 shadow-lg mb-2">
                                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                                    <input
                                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm font-semibold"
                                        type="number"
                                        value={form.order} onChange={e => setForm({ ...form, order: Number(e.target.value) })}
                                    />
                                    <input
                                        className="w-full sm:col-span-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm font-semibold"
                                        value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                                    />
                                    <div className="flex items-center px-1">
                                        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 font-bold cursor-pointer">
                                            <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} className="w-4 h-4 rounded text-primary focus:ring-primary" />
                                            Activo
                                        </label>
                                    </div>
                                </div>
                                <div className="flex items-center justify-end gap-3 border-t border-slate-50 pt-3">
                                    <button onClick={() => handleSave(item.id)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors"><Save className="w-4 h-4" /> Guardar</button>
                                    <button onClick={() => setEditingId(null)} className="flex items-center gap-2 px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-300 transition-colors"><X className="w-4 h-4" /> Cancelar</button>
                                </div>
                            </div>
                        ) : (
                            <div key={item.id} className="flex items-center justify-between bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/80 p-4 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 transition-all shadow-sm">
                                <div className="flex items-center gap-4 flex-1 overflow-hidden">
                                    <span className="w-8 h-8 flex items-center justify-center bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-black text-xs rounded-lg shrink-0">{item.order}</span>
                                    <span className={`font-bold text-sm truncate ${item.active ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500 line-through'}`}>{item.description}</span>
                                    {!item.active && <span className="px-2 py-0.5 bg-rose-100 text-rose-600 text-[10px] uppercase font-black tracking-widest rounded-md shrink-0">Inactivo</span>}
                                </div>
                                <div className="flex items-center gap-1 ml-4 shrink-0">
                                    <button onClick={() => { setEditingId(item.id); setForm({ description: item.description, active: item.active, order: item.order }); }} className="btn-icon-inline text-slate-400 dark:text-slate-500 hover:text-primary p-2 transition-colors"><Edit2 className="w-4 h-4" /></button>
                                    <button onClick={() => handleDelete(item.id)} className="btn-icon-inline text-slate-400 dark:text-slate-500 hover:text-rose-500 p-2 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            </div>
                        )
                    ))}

                    {checklists.length === 0 && editingId !== 'new' && (
                        <div className="py-8 text-center text-slate-400 dark:text-slate-500 text-sm font-bold">No hay ítems configurados en esta etiqueta.</div>
                    )}
                </div>
            )}

            <ConfirmDialog
                isOpen={isConfirmOpen}
                title="¿Eliminar ítem del checklist?"
                message="Este punto ya no aparecerá en los nuevos proyectos que utilicen esta etiqueta."
                onConfirm={confirmDelete}
                onCancel={() => setIsConfirmOpen(false)}
            />
        </div>
    );
}

// ----- OPTIONS SECTION -----
function OptionsSection() {
    const [options, setOptions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState<string>('AREA_DEMORA');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState({ value: '', order: 0, active: true });

    // Confirm dialog
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);

    const categories = [
        { id: 'AREA_DEMORA', label: 'Áreas de Demora Cliente' },
        { id: 'MOTIVO_DEMORA', label: 'Motivos de Demora' },
        { id: 'CATEGORIA', label: 'Categorías de Proyecto' },
        { id: 'TIPO_ACTIVIDAD', label: 'Tipos de Actividad' },
        { id: 'CAUSA_REGISTRO', label: 'Causas de Registro de Tiempo' }
    ];

    useEffect(() => { loadOptions(); }, [selectedCategory]);

    const loadOptions = () => {
        setLoading(true);
        safeApiRequest(`/api/config/options?category=${selectedCategory}`)
            .then(res => res.json())
            .then(data => { setOptions(Array.isArray(data) ? data : []); setLoading(false); })
            .catch(() => setLoading(false));
    };

    const handleSave = async (id?: string) => {
        if (!form.value.trim()) return;
        const method = id ? 'PUT' : 'POST';
        const body = id ? { id, category: selectedCategory, ...form } : { category: selectedCategory, ...form };

        await safeApiRequest('/api/config/options', {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        setEditingId(null);
        setForm({ value: '', order: 0, active: true });
        loadOptions();
    };

    const handleDelete = async (id: string) => {
        setItemToDelete(id);
        setIsConfirmOpen(true);
    };

    const confirmDelete = async () => {
        if (!itemToDelete) return;
        await safeApiRequest(`/api/config/options?id=${itemToDelete}`, { method: 'DELETE' });
        setIsConfirmOpen(false);
        setItemToDelete(null);
        loadOptions();
    };

    if (loading) return <div>Cargando...</div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Desplegables del Sistema</h3>
                <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800/50 rounded-xl overflow-x-auto w-full md:w-auto">
                    {categories.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setSelectedCategory(cat.id)}
                            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all ${selectedCategory === cat.id ? 'bg-white dark:bg-slate-800 text-primary shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            {cat.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="space-y-3">
                <button
                    onClick={() => { setEditingId('new'); setForm({ value: '', order: options.length, active: true }); }}
                    className="flex items-center gap-2 bg-primary/10 text-primary hover:bg-primary hover:text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors w-full justify-center mb-6"
                >
                    <Plus className="w-4 h-4" /> Agregar Opción
                </button>

                {editingId === 'new' && (
                    <div className="flex flex-col gap-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-primary/20">
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                            <input
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm font-semibold"
                                type="number" placeholder="Orden"
                                value={form.order} onChange={e => setForm({ ...form, order: Number(e.target.value) })}
                            />
                            <input
                                className="w-full sm:col-span-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm font-semibold"
                                placeholder="Valor visible"
                                value={form.value} onChange={e => setForm({ ...form, value: e.target.value })}
                            />
                            <div className="flex items-center px-1">
                                <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 font-bold cursor-pointer">
                                    <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} className="w-4 h-4 rounded text-primary focus:ring-primary" />
                                    Activo
                                </label>
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800 pt-3">
                            <button onClick={() => handleSave()} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors"><Save className="w-4 h-4" /> Guardar</button>
                            <button onClick={() => setEditingId(null)} className="flex items-center gap-2 px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-300 transition-colors"><X className="w-4 h-4" /> Cancelar</button>
                        </div>
                    </div>
                )}

                {options.map((opt: any) => (
                    editingId === opt.id ? (
                        <div key={opt.id} className="flex flex-col gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-primary/20 shadow-lg">
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                                <input
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm font-semibold"
                                    type="number"
                                    value={form.order} onChange={e => setForm({ ...form, order: Number(e.target.value) })}
                                />
                                <input
                                    className="w-full sm:col-span-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm font-semibold"
                                    value={form.value} onChange={e => setForm({ ...form, value: e.target.value })}
                                />
                                <div className="flex items-center px-1">
                                    <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 font-bold cursor-pointer">
                                        <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} className="w-4 h-4 rounded text-primary focus:ring-primary" />
                                        Activo
                                    </label>
                                </div>
                            </div>
                            <div className="flex items-center justify-end gap-3 border-t border-slate-50 pt-3">
                                <button onClick={() => handleSave(opt.id)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors"><Save className="w-4 h-4" /> Guardar</button>
                                <button onClick={() => setEditingId(null)} className="flex items-center gap-2 px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-300 transition-colors"><X className="w-4 h-4" /> Cancelar</button>
                            </div>
                        </div>
                    ) : (
                        <div key={opt.id} className="flex items-center justify-between bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/80 p-4 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 transition-all shadow-sm">
                            <div className="flex items-center gap-4 flex-1">
                                <span className="w-8 h-8 flex items-center justify-center bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-black text-xs rounded-lg shrink-0">{opt.order}</span>
                                <span className={`font-bold text-sm ${opt.active ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500 line-through'}`}>{opt.value}</span>
                                {!opt.active && <span className="px-2 py-0.5 bg-rose-100 text-rose-600 text-[10px] uppercase font-black tracking-widest rounded-md shrink-0">Inactivo</span>}
                            </div>
                            <div className="flex items-center gap-1 ml-4 shrink-0">
                                <button onClick={() => { setEditingId(opt.id); setForm({ value: opt.value, active: opt.active, order: opt.order }); }} className="btn-icon-inline text-slate-400 dark:text-slate-500 hover:text-primary p-2 transition-colors"><Edit2 className="w-4 h-4" /></button>
                                <button onClick={() => handleDelete(opt.id)} className="btn-icon-inline text-slate-400 dark:text-slate-500 hover:text-rose-500 p-2 transition-colors"><Trash2 className="w-4 h-4" /></button>
                            </div>
                        </div>
                    )
                ))}

                {options.length === 0 && editingId !== 'new' && (
                    <div className="py-8 text-center text-slate-400 dark:text-slate-500 text-sm font-bold">No hay opciones configuradas.</div>
                )}
            </div>

            <ConfirmDialog
                isOpen={isConfirmOpen}
                title="¿Eliminar opción?"
                message="Esta opción dejará de estar disponible en los desplegables del sistema."
                onConfirm={confirmDelete}
                onCancel={() => setIsConfirmOpen(false)}
            />
        </div>
    );
}

// ----- SYSTEM SECTION -----
function SystemSection() {
    const [setting, setSetting] = useState({
        dailyReminderEnabled: false,
        dailyReminderTime: '16:45',
        companyGeofenceLat: null,
        companyGeofenceLng: null,
        companyGeofenceRadius: null,
        companyQrToken: '',
        daysWithoutHoursThreshold: 5,
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [triggering, setTriggering] = useState(false);
    const [isConfirmTriggerOpen, setIsConfirmTriggerOpen] = useState(false);

    useEffect(() => {
        safeApiRequest('/api/config/system')
            .then(res => res.json())
            .then(data => { setSetting(data); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            // Get current to merge and not lose OS values
            const currentRes = await safeApiRequest('/api/config/system');
            const currentData = await currentRes.json();

            const body = {
                ...currentData,
                dailyReminderEnabled: setting.dailyReminderEnabled,
                companyGeofenceLat: setting.companyGeofenceLat,
                companyGeofenceLng: setting.companyGeofenceLng,
                companyGeofenceRadius: setting.companyGeofenceRadius,
                companyQrToken: setting.companyQrToken,
                daysWithoutHoursThreshold: setting.daysWithoutHoursThreshold
            };

            await safeApiRequest('/api/config/system', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            showToast('Configuración de sistema guardada correctamente.', 'success');
        } catch (e) {
            showToast('Error al guardar configuración.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleManualTrigger = async () => {
        setIsConfirmTriggerOpen(true);
    };

    const confirmManualTrigger = async () => {
        setIsConfirmTriggerOpen(false);

        setTriggering(true);
        try {
            // We use a custom auth param for manual trigger from UI (since CRON_SECRET is server-only)
            const res = await safeApiRequest('/api/cron/reminders?manual=true', {
                method: 'GET'
            });

            if (res.ok) {
                const data = await res.json();
                showToast(`Alertas enviadas: ${data.reminded} recordatorios, ${data.absentAlerts} ausentismos.`, 'success');
            } else {
                const error = await res.text();
                showToast(`Error: ${error}`, 'error');
            }
        } catch (e) {
            showToast('Error al procesar las alertas.', 'error');
        } finally {
            setTriggering(false);
        }
    };

    if (loading) return <div>Cargando...</div>;

    return (
        <div className="space-y-6 max-w-lg">
            <div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Alertas y Sistema</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Configura opciones automáticas del sistema.</p>
            </div>

            <div className="space-y-4 bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                    <div>
                        <h4 className="font-bold text-slate-800 dark:text-slate-100">Alerta Diaria de Carga de Horas</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            Notificar a operadores y ausentismos mayores a {setting.daysWithoutHoursThreshold || 5} días.
                        </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={setting.dailyReminderEnabled}
                            onChange={e => setSetting({ ...setting, dailyReminderEnabled: e.target.checked })}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                </div>

                {setting.dailyReminderEnabled && (
                    <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">
                                Días sin registrar horas para notificación
                            </label>
                            <input
                                type="number"
                                min={1}
                                value={setting.daysWithoutHoursThreshold || 5}
                                onChange={e => setSetting({ ...setting, daysWithoutHoursThreshold: parseInt(e.target.value) || 0 })}
                                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 outline-none font-bold text-slate-700 dark:text-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm"
                                placeholder="Ej: 5"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">
                                Horario de Disparo (Nativo Vercel una vez por día)
                            </label>
                            <p className="text-[9px] text-amber-600 font-bold px-1 -mt-1">
                                Nota: En Vercel Free el cron corre una vez al día (Configurado a las 18:00hs ART).
                            </p>
                            <input
                                type="time"
                                disabled
                                value="18:00"
                                className="w-full bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 outline-none font-bold text-slate-500 dark:text-slate-400 cursor-not-allowed"
                            />
                        </div>
                    </div>
                )}
            </div>


            <div className="space-y-4 bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 mt-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h4 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            <MapPin className="w-4 h-4" /> Fichaje en Base / Empresa
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            Habilita el fichado GPS/QR para la base u oficina principal.
                        </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={(setting as any).fichajeHabilitado || false}
                            onChange={e => setSetting({ ...setting, fichajeHabilitado: e.target.checked } as any)}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                </div>

                {(setting as any).fichajeHabilitado && (
                    <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-700 animate-in fade-in slide-in-from-top-2 duration-300">
                        <MapPicker 
                            lat={setting.companyGeofenceLat} 
                            lng={setting.companyGeofenceLng} 
                            radius={setting.companyGeofenceRadius} 
                            onChange={(lat, lng, radius) => {
                                setSetting({
                                    ...setting,
                                    companyGeofenceLat: lat,
                                    companyGeofenceLng: lng,
                                    companyGeofenceRadius: radius
                                });
                            }}
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Latitud</label>
                                <input type="number" step="any" value={setting.companyGeofenceLat || ''} onChange={e => setSetting({ ...setting, companyGeofenceLat: e.target.value === '' ? null : parseFloat(e.target.value) })} className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 outline-none font-bold text-slate-700 dark:text-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm" placeholder="-34.123456" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Longitud</label>
                                <input type="number" step="any" value={setting.companyGeofenceLng || ''} onChange={e => setSetting({ ...setting, companyGeofenceLng: e.target.value === '' ? null : parseFloat(e.target.value) })} className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 outline-none font-bold text-slate-700 dark:text-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm" placeholder="-58.123456" />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Radio de Validación (Metros)</label>
                            <input type="number" value={setting.companyGeofenceRadius || ''} onChange={e => setSetting({ ...setting, companyGeofenceRadius: e.target.value === '' ? null : parseInt(e.target.value) })} className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 outline-none font-bold text-slate-700 dark:text-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm" placeholder="Ej: 200" />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Token de Validación QR (Empresa)</label>
                            <div className="flex gap-2">
                                <input type="text" value={setting.companyQrToken || ''} onChange={e => setSetting({ ...setting, companyQrToken: e.target.value.toUpperCase() })} className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 outline-none font-bold text-slate-700 dark:text-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm font-mono" placeholder="TOKEN-BASE" />
                                <button type="button" onClick={() => setSetting({ ...setting, companyQrToken: Math.random().toString(36).substring(2, 10).toUpperCase() })} className="px-3 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 rounded-xl text-slate-600 dark:text-slate-300 transition-all active:scale-95" title="Generar Nuevo Token">
                                    <Play className="w-4 h-4 rotate-90" />
                                </button>
                            </div>
                        </div>

                        {setting.companyQrToken && (
                            <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex flex-col items-center gap-4">
                                <div id="company-qr" className="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm">
                                    <QRCodeCanvas value={setting.companyQrToken} size={200} level="H" includeMargin={true} />
                                </div>
                                <button onClick={() => { const canvas = document.querySelector('#company-qr canvas') as HTMLCanvasElement; if (canvas) { const win = window.open('', '_blank'); if (win) { win.document.write(`<html><head><title>Imprimir QR - HDB Base</title><style>body{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;}.container{text-align:center;border:2px solid #000;padding:40px;border-radius:20px;}h1{margin-bottom:20px;font-size:24px;}p{margin-top:20px;font-weight:bold;font-size:18px;color:#666;}img{width:300px;height:300px;}</style></head><body><div class="container"><h1>HDB SERVICIOS ELÉCTRICOS</h1><h2>Ficha de Ingreso - BASE / EMPRESA</h2><img src="${canvas.toDataURL()}" /><p>TOKEN: ${setting.companyQrToken}</p></div><script>window.onload=()=>{setTimeout(()=>{window.print();window.onafterprint=()=>window.close();},500);};</script></body></html>`); } } }} className="flex items-center gap-2 px-6 py-2 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-700 transition-all"><QrCode className="w-4 h-4" /> Imprimir QR de Empresa</button>
                            </div>
                        )}

                        {/* Independent save button for fichaje base config */}
                        <button
                            onClick={async () => {
                                try {
                                    const currentRes = await safeApiRequest('/api/config/system');
                                    const currentData = await currentRes.json();
                                    await safeApiRequest('/api/config/system', {
                                        method: 'PUT',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            ...currentData,
                                            fichajeHabilitado: (setting as any).fichajeHabilitado,
                                            companyGeofenceLat: setting.companyGeofenceLat,
                                            companyGeofenceLng: setting.companyGeofenceLng,
                                            companyGeofenceRadius: setting.companyGeofenceRadius,
                                            companyQrToken: setting.companyQrToken,
                                        })
                                    });
                                    showToast('Configuración de fichaje de la empresa guardada correctamente.', 'success');
                                } catch (e) {
                                    showToast('Error al guardar configuración de fichaje.', 'error');
                                }
                            }}
                            className="w-full bg-emerald-600 text-white font-bold rounded-xl py-3 hover:bg-emerald-700 transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                            <Save className="w-4 h-4" /> Guardar Config. Fichaje Base
                        </button>
                    </div>
                )}
            </div>

            <div className="pt-2">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full mt-4 bg-primary text-white font-bold rounded-xl py-3 hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-50"
                >
                    {saving ? 'Guardando...' : 'Guardar Cambios'}
                </button>
            </div>

            <div className="space-y-4 bg-indigo-50/50 p-6 rounded-2xl border border-indigo-100 mt-6">
                <div>
                    <h4 className="font-bold text-indigo-900 flex items-center gap-2">
                        <Play className="w-4 h-4" /> Ejecución Manual
                    </h4>
                    <p className="text-xs text-indigo-700/70 mt-1">
                        Dispara las alertas de carga de horas y ausentismo inmediatamente, sin esperar al proceso programado.
                    </p>
                </div>
                <button
                    onClick={handleManualTrigger}
                    disabled={triggering}
                    className="w-full bg-white dark:bg-slate-800 border border-indigo-200 text-indigo-600 font-bold rounded-xl py-3 hover:bg-indigo-50 transition-all active:scale-95 disabled:opacity-50 shadow-sm flex items-center justify-center gap-2"
                >
                    {triggering ? (
                        <div className="w-5 h-5 border-2 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin"></div>
                    ) : (
                        <>Disparar ahora</>
                    )}
                </button>
            </div>

            <ConfirmDialog
                isOpen={isConfirmTriggerOpen}
                title="¿Disparar alertas ahora?"
                message="Esto notificará a todos los operadores que no cargaron horas hoy mediante notificaciones PUSH inmediatamente."
                onConfirm={confirmManualTrigger}
                onCancel={() => setIsConfirmTriggerOpen(false)}
                confirmLabel="Disparar ahora"
                variant="info"
            />
        </div>
    );
}

// ----- VIEWS ACCESS SECTION -----
function ViewsSection() {
    const [views, setViews] = useState<ViewConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        safeApiRequest('/api/config/views')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data) && data.length > 0) {
                    setViews(getViewConfig(data));
                } else {
                    setViews(DEFAULT_VIEWS.map(v => ({ ...v })));
                }
                setLoading(false);
            })
            .catch(() => {
                setViews(DEFAULT_VIEWS.map(v => ({ ...v })));
                setLoading(false);
            });
    }, []);

    const toggleRole = (viewKey: string, role: string) => {
        setViews(prev => prev.map(v => {
            if (v.key !== viewKey) return v;
            const roles = v.roles.includes(role)
                ? v.roles.filter(r => r !== role)
                : [...v.roles, role];
            return { ...v, roles };
        }));
    };

    const setAccessValue = (viewKey: string, access: 'sidebar' | 'home' | 'ambos') => {
        setViews(prev => prev.map(v => {
            if (v.key !== viewKey) return v;
            return { ...v, access };
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await safeApiRequest('/api/config/views', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(views)
            });
            // Refetch the updated view configuration
            const res = await safeApiRequest('/api/config/views');
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
                setViews(getViewConfig(data));
            }
            showToast('Configuración de vistas guardada correctamente.', 'success');
            // Reload the page to apply updated view permissions across the app
            if (typeof window !== 'undefined') {
                window.location.reload();
            }
        } catch (e) {
            showToast('Error al guardar configuración de vistas.', 'error');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div>Cargando...</div>;

    const allRoles = [
        { id: 'operador', label: 'Operador', color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' },
        { id: 'supervisor', label: 'Supervisor', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
        { id: 'admin', label: 'Admin', color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' },
        { id: 'vendedor', label: 'Vendedor', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
    ];

    const accessOptions: { id: 'sidebar' | 'home' | 'ambos'; label: string }[] = [
        { id: 'sidebar', label: 'Panel Lateral' },
        { id: 'home', label: 'Home' },
        { id: 'ambos', label: 'Ambos' },
    ];

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Acceso a Vistas</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                    Configura qué roles pueden acceder a cada vista y desde dónde es accesible.
                </p>
            </div>

            <div className="space-y-3">
                {views.map(view => (
                    <div
                        key={view.key}
                        className="bg-slate-50 dark:bg-slate-900/50 p-4 md:p-5 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 transition-all space-y-4"
                    >
                        {/* View header */}
                        <div className="flex items-center gap-3">
                            <span className="font-bold text-slate-800 dark:text-slate-100 text-sm md:text-base">{view.label}</span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">{view.key}</span>
                        </div>

                        {/* Controls */}
                        <div className="flex flex-col md:flex-row md:items-center gap-4">
                            {/* Roles */}
                            <div className="flex-1">
                                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 block px-0.5">
                                    Roles con Acceso
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {allRoles.map(r => {
                                        const isActive = view.roles.includes(r.id);
                                        return (
                                            <button
                                                key={r.id}
                                                onClick={() => toggleRole(view.key, r.id)}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                                    isActive
                                                        ? `${r.color} border-transparent shadow-sm`
                                                        : 'bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 opacity-50 hover:opacity-75'
                                                }`}
                                            >
                                                {r.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Access location */}
                            <div className="shrink-0">
                                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 block px-0.5">
                                    Ubicación
                                </label>
                                <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800/50 rounded-xl">
                                    {accessOptions.map(opt => (
                                        <button
                                            key={opt.id}
                                            onClick={() => setAccessValue(view.key, opt.id)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                                view.access === opt.id
                                                    ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                                            }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <button
                onClick={handleSave}
                disabled={saving}
                className="w-full bg-primary text-white font-bold rounded-xl py-3 hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-50"
            >
                {saving ? 'Guardando...' : 'Guardar Configuración de Vistas'}
            </button>
        </div>
    );
}
