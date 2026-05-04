'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { PackageSearch, Plus, Upload, Download, Search, Edit2, Trash2, X, AlertCircle, Loader2 } from 'lucide-react';
import { safeApiRequest } from '@/lib/offline';
import { showToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import { ViewConfig, isViewAllowed } from '@/lib/viewAccess';

interface Material {
    codigo: string;
    nombre: string;
    precioVenta: number | null;
    costo: number | null;
}

export default function InventarioPage() {
    const [materiales, setMateriales] = useState<Material[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Modal states
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [currentCode, setCurrentCode] = useState<string>('');
    const [formData, setFormData] = useState({ codigo: '', nombre: '', precioVenta: '', costo: '' });
    const [isSaving, setIsSaving] = useState(false);
    
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [deleteCode, setDeleteCode] = useState<string | null>(null);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [viewConfig, setViewConfig] = useState<ViewConfig[] | null>(null);

    useEffect(() => {
        const u = localStorage.getItem('currentUser');
        if (u) setCurrentUser(JSON.parse(u));
        loadMateriales();
        fetch('/api/config/views')
            .then(r => r.json())
            .then(data => { if (Array.isArray(data) && data.length > 0) setViewConfig(data); })
            .catch(() => {});
    }, []);

    const loadMateriales = async () => {
        setLoading(true);
        try {
            const res = await safeApiRequest('/api/inventario');
            if (res.ok) setMateriales(await res.json());
        } catch {
            showToast('Error cargando inventario', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const isEdit = currentCode !== '';
            const url = isEdit ? `/api/inventario/${currentCode}` : '/api/inventario';
            const method = isEdit ? 'PUT' : 'POST';
            
            const reqBody = {
                codigo: formData.codigo,
                nombre: formData.nombre,
                precioVenta: formData.precioVenta === '' ? null : formData.precioVenta,
                costo: formData.costo === '' ? null : formData.costo,
            };

            const res = await safeApiRequest(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(reqBody)
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error);
            }

            showToast(`Material ${isEdit ? 'actualizado' : 'creado'} con éxito`, 'success');
            setIsEditModalOpen(false);
            loadMateriales();
        } catch (err: any) {
            showToast(err.message || 'Error guardando material', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteCode) return;
        try {
            const res = await safeApiRequest(`/api/inventario/${deleteCode}`, { method: 'DELETE' });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error);
            }
            showToast('Material eliminado', 'success');
            setMateriales(prev => prev.filter(m => m.codigo !== deleteCode));
        } catch (err: any) {
            showToast(err.message || 'Error eliminando', 'error');
        } finally {
            setDeleteCode(null);
        }
    };

    const handleImportSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!importFile) return;

        setIsImporting(true);
        const data = new FormData();
        data.append('file', importFile);

        try {
            const res = await safeApiRequest('/api/inventario/importar', {
                method: 'POST',
                body: data
            });

            const result = await res.json();
            if (!res.ok) throw new Error(result.error);

            if (result.errores?.length > 0) {
                showToast(`Se procesaron ${result.procesados} correctamente. Hubo ${result.errores.length} errores.`, 'info');
                console.warn('Errores de importación:', result.errores);
            } else {
                showToast(`Se procesaron ${result.procesados} materiales correctamente.`, 'success');
            }
            setIsImportModalOpen(false);
            setImportFile(null);
            loadMateriales();
        } catch (err: any) {
            showToast(err.message || 'Error importando archivo', 'error');
        } finally {
            setIsImporting(false);
        }
    };

    const descargarPlantilla = () => {
        window.location.href = '/api/inventario/exportar-plantilla';
    };

    const openCreateModal = () => {
        setCurrentCode('');
        setFormData({ codigo: '', nombre: '', precioVenta: '', costo: '' });
        setIsEditModalOpen(true);
    };

    const openEditModal = (m: Material) => {
        setCurrentCode(m.codigo);
        setFormData({ 
            codigo: m.codigo, 
            nombre: m.nombre, 
            precioVenta: m.precioVenta?.toString() || '', 
            costo: m.costo?.toString() || '' 
        });
        setIsEditModalOpen(true);
    };

    const [searchMode, setSearchMode] = useState<'codigo' | 'nombre'>('codigo');

    const filtered = useMemo(() => {
        const term = searchTerm.toLowerCase().trim();
        if (!term) return materiales.slice(0, 100);

        if (searchMode === 'nombre') {
            return materiales.filter(m => m.nombre.toLowerCase().includes(term)).slice(0, 100);
        } else {
            const termNoZeros = term.replace(/^0+/, '');
            
            let matches = materiales.filter(m => {
                const mCodeNoZeros = m.codigo.replace(/^0+/, '').toLowerCase();
                return mCodeNoZeros.startsWith(termNoZeros);
            });

            // Organizar de menor a mayor (numéricamente)
            matches.sort((a, b) => {
                const aCode = a.codigo.replace(/^0+/, '').toLowerCase();
                const bCode = b.codigo.replace(/^0+/, '').toLowerCase();
                if (aCode === termNoZeros) return -1;
                if (bCode === termNoZeros) return 1;
                return aCode.localeCompare(bCode, undefined, { numeric: true });
            });

            // Si hay coincidencia exacta, se reduce a 1 solo material
            const exactMatch = matches.find(m => m.codigo.replace(/^0+/, '').toLowerCase() === termNoZeros);
            if (exactMatch) {
                matches = [exactMatch];
            }

            return matches.slice(0, 100);
        }
    }, [materiales, searchTerm, searchMode]);

    const role = currentUser?.role?.trim().toLowerCase() || '';
    const hasAccess = !role || !viewConfig || isViewAllowed('/inventario', role, 'sidebar', viewConfig);

    if (!loading && !hasAccess && role) {
        return (
            <div className="max-w-2xl mx-auto py-20 text-center space-y-4">
                <AlertCircle className="w-12 h-12 text-slate-300 mx-auto" />
                <p className="text-slate-500 font-medium">No tenés permisos para acceder a esta sección.</p>
            </div>
        );
    }

    return (
        <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div className="space-y-1">
                    <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight flex items-center gap-2">
                        <PackageSearch className="w-6 h-6 md:w-8 md:h-8 text-primary" />
                        Inventario de Materiales
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">Gestiona la lista maestra de materiales y sus precios de venta.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setIsImportModalOpen(true)} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all text-sm shadow-sm">
                        <Upload className="w-4 h-4"/> Importar Excel
                    </button>
                    <button onClick={openCreateModal} className="px-4 py-2 bg-primary text-white rounded-xl font-bold flex items-center gap-2 hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 text-sm">
                        <Plus className="w-4 h-4"/> Nuevo Material
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-[2rem] p-4 md:p-6 shadow-sm space-y-4">
                <div className="flex flex-col md:flex-row gap-3">
                    <div className="relative group flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                        <input
                            type="text"
                            placeholder={searchMode === 'codigo' ? "Buscar por código (ej: 004 o 4)..." : "Buscar por nombre..."}
                            className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm font-medium"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex bg-slate-100 dark:bg-slate-900/50 p-1 rounded-xl w-fit border border-slate-200 dark:border-slate-700">
                        <button 
                            onClick={() => { setSearchMode('codigo'); setSearchTerm(''); }}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${searchMode === 'codigo' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Por Código
                        </button>
                        <button 
                            onClick={() => { setSearchMode('nombre'); setSearchTerm(''); }}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${searchMode === 'nombre' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Por Nombre
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>
                ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] tracking-widest border-b border-slate-200 dark:border-slate-700">
                                <tr>
                                    <th className="px-4 py-3">Código</th>
                                    <th className="px-4 py-3">Material</th>
                                    <th className="px-4 py-3 text-right">Precio Venta</th>
                                    <th className="px-4 py-3 text-right">Costo</th>
                                    <th className="px-4 py-3 text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-800">
                                {filtered.length === 0 ? (
                                    <tr><td colSpan={5} className="py-8 text-center text-slate-500 font-medium">No se encontraron materiales</td></tr>
                                ) : filtered.map(m => (
                                    <tr key={m.codigo} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="px-4 py-3 font-mono text-xs font-bold text-slate-600 dark:text-slate-300">{m.codigo}</td>
                                        <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-100">{m.nombre}</td>
                                        <td className="px-4 py-3 text-right text-emerald-600 font-black">
                                            {m.precioVenta != null ? `$${m.precioVenta.toLocaleString('es-AR')}` : <span className="text-slate-300">—</span>}
                                        </td>
                                        <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300 font-bold">
                                            {m.costo != null ? `$${m.costo.toLocaleString('es-AR')}` : <span className="text-slate-300">—</span>}
                                        </td>
                                        <td className="px-4 py-3 flex items-center justify-center gap-2">
                                            <button onClick={() => openEditModal(m)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Edit2 className="w-4 h-4"/></button>
                                            <button onClick={() => setDeleteCode(m.codigo)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4"/></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal Crear/Editar */}
            {isEditModalOpen && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-[2rem] shadow-2xl p-6 border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">{currentCode ? 'Editar Material' : 'Nuevo Material'}</h3>
                            <button onClick={() => setIsEditModalOpen(false)} className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-full hover:text-slate-600 hover:bg-slate-200 transition-colors"><X className="w-5 h-5"/></button>
                        </div>
                        <form onSubmit={handleSave} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Código</label>
                                <input required disabled={!!currentCode} type="text" value={formData.codigo} onChange={e => setFormData({...formData, codigo: e.target.value.toUpperCase()})} className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 font-mono text-sm outline-none focus:border-primary disabled:opacity-60" placeholder="Ej: MAT-001"/>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Material (Nombre)</label>
                                <input required type="text" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 font-medium text-sm outline-none focus:border-primary" placeholder="Ej: Cable unipolar 2.5mm..."/>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Precio Venta</label>
                                    <input type="number" step="any" min="0" value={formData.precioVenta} onChange={e => setFormData({...formData, precioVenta: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 font-bold text-emerald-600 text-sm outline-none focus:border-emerald-500" placeholder="Vacio = sin precio" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Costo</label>
                                    <input type="number" step="any" min="0" value={formData.costo} onChange={e => setFormData({...formData, costo: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 font-bold text-slate-600 dark:text-slate-300 text-sm outline-none focus:border-primary" placeholder="Opcional" />
                                </div>
                            </div>
                            <button disabled={isSaving} type="submit" className="w-full mt-4 bg-primary text-white py-3 rounded-xl font-bold flex justify-center items-center gap-2 hover:bg-primary/90 transition-all">
                                {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Guardar Material'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Importar */}
            {isImportModalOpen && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-[2rem] shadow-2xl p-6 border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-200 space-y-6">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2"><Upload className="w-5 h-5"/> Importar Excel</h3>
                            <button onClick={() => setIsImportModalOpen(false)} className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-full"><X className="w-5 h-5"/></button>
                        </div>
                        
                        <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                            <h4 className="text-xs font-black text-amber-700 uppercase mb-1 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> Importante</h4>
                            <p className="text-xs text-amber-600 mb-2">Para importar, el archivo Excel <b>DEBE</b> tener exactamente las columnas: <code className="font-bold">Codigo, Material, Precio Venta, Costo</code>.</p>
                            <p className="text-xs text-amber-600">Si un Código ya existe será actualizado (sobreescribiendo cualquier precio manual anterior).</p>
                        </div>

                        <form onSubmit={handleImportSubmit} className="space-y-4">
                            <div 
                                className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <Upload className={`w-8 h-8 mb-3 ${importFile ? 'text-emerald-500' : 'text-slate-400'}`} />
                                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{importFile ? importFile.name : 'Seleccionar archivo .xlsx'}</p>
                                <p className="text-xs font-medium text-slate-400 mt-1">Haz clic para explorar</p>
                                <input type="file" ref={fileInputRef} accept=".xlsx,.xls" className="hidden" onChange={e => { if (e.target.files) setImportFile(e.target.files[0])}} />
                            </div>

                            <button type="button" onClick={descargarPlantilla} className="w-full py-2.5 text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 font-bold rounded-xl flex items-center justify-center gap-2 text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                                <Download className="w-4 h-4"/> Descargar Plantilla Vacía
                            </button>

                            <button disabled={!importFile || isImporting} type="submit" className="w-full bg-primary text-white py-3 rounded-xl font-bold flex justify-center items-center gap-2 hover:bg-primary/90 transition-all shadow-lg active:scale-95 disabled:opacity-50">
                                {isImporting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Procesar Importación'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            <ConfirmDialog
                isOpen={!!deleteCode}
                title="Eliminar Material"
                message="¿Estás seguro de eliminar este material? Se borrará de la base de datos."
                onConfirm={handleDelete}
                onCancel={() => setDeleteCode(null)}
                variant="danger"
            />
        </div>
    );
}
