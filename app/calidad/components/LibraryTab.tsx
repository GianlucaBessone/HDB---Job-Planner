'use client';

import { useState, useEffect, useMemo } from 'react';
import { safeApiRequest } from '@/lib/offline';
import {
    Search,
    Plus,
    FileText,
    Eye,
    FolderTree,
    LayoutGrid,
    UploadCloud,
    Settings2,
    Compass,
    Layers,
    LifeBuoy,
    ChevronDown,
    ChevronRight,
    Sparkles,
    FileCheck2,
    FileSpreadsheet,
    FileImage,
    Edit2,
    CheckCircle2,
    FolderPlus,
    Filter,
    HelpCircle,
    Download,
    Trash2,
    Table,
    ArrowUpDown,
    ArrowUp,
    ArrowDown
} from 'lucide-react';
import { showToast } from '@/components/Toast';
import DocumentDetailModal from './DocumentDetailModal';
import NewDocumentModal from './NewDocumentModal';
import ManageSubAccessModal, { getSubAccessIcon } from './ManageSubAccessModal';
import QuickUploadDocModal from './QuickUploadDocModal';
import ConfirmModal from '@/components/ConfirmModal';

let cachedLibraryDocs: any[] | null = null;
let cachedAccessModules: any[] | null = null;

export default function LibraryTab({ user, initialDocId }: { user: any; initialDocId?: string | null }) {
    const [viewMode, setViewMode] = useState<'structured' | 'grid' | 'table'>('structured');
    const [sortColumn, setSortColumn] = useState<'codigo' | 'titulo' | 'version' | 'tipo' | 'estado' | 'vencimiento'>('codigo');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [docToDelete, setDocToDelete] = useState<{ id: string; codigo: string; titulo: string } | null>(null);
    const [modules, setModules] = useState<any[]>([]);
    const [docs, setDocs] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedDocId, setSelectedDocId] = useState<string | null>(initialDocId || null);

    useEffect(() => {
        if (initialDocId) {
            setSelectedDocId(initialDocId);
        }
    }, [initialDocId]);

    // Filter controls
    const [selectedModuleFilter, setSelectedModuleFilter] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');

    // Expanded module / sub-access accordion state
    const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({
        '1': true,
        '2': true,
        '3': true
    });
    const [expandedSubAccesses, setExpandedSubAccesses] = useState<Record<string, boolean>>({});

    // Modal states
    const [isNewModalOpen, setIsNewModalOpen] = useState(false);
    const [isQuickUploadOpen, setIsQuickUploadOpen] = useState(false);
    const [isManageSubAccessOpen, setIsManageSubAccessOpen] = useState(false);
    const [targetSubAccessId, setTargetSubAccessId] = useState<string | null>(null);
    const [targetModuleId, setTargetModuleId] = useState<string | null>(null);
    const [subAccessToEdit, setSubAccessToEdit] = useState<any | null>(null);

    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearchQuery(searchQuery);
        }, 250);
        return () => clearTimeout(handler);
    }, [searchQuery]);

    useEffect(() => {
        loadData();
    }, [debouncedSearchQuery]);

    const loadData = async () => {
        let showLoader = true;
        if (cachedLibraryDocs && cachedAccessModules && !debouncedSearchQuery) {
            setDocs(cachedLibraryDocs);
            setModules(cachedAccessModules);
            showLoader = false;
        }
        if (showLoader) {
            setIsLoading(true);
        }

        try {
            const params = new URLSearchParams();
            if (debouncedSearchQuery) params.set('search', debouncedSearchQuery);

            const [docsRes, accesosRes] = await Promise.all([
                safeApiRequest(`/api/documentos?${params}`),
                safeApiRequest('/api/documentos/accesos')
            ]);

            if (docsRes.ok && accesosRes.ok) {
                const docsData = await docsRes.json();
                const accesosData = await accesosRes.json();

                if (!debouncedSearchQuery) {
                    cachedLibraryDocs = docsData;
                    cachedAccessModules = accesosData.modules || [];
                }

                setDocs(docsData);
                setModules(accesosData.modules || []);
            }
        } catch (e) {
            console.error('Error loading library data:', e);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleModuleExpand = (modCodigo: string) => {
        setExpandedModules(prev => ({
            ...prev,
            [modCodigo]: !prev[modCodigo]
        }));
    };

    const toggleSubAccessExpand = (subId: string) => {
        setExpandedSubAccesses(prev => ({
            ...prev,
            [subId]: !prev[subId]
        }));
    };

    // Quick Action Triggers
    const handleOpenNewDoc = (subAccessId?: string) => {
        setTargetSubAccessId(subAccessId || null);
        setIsNewModalOpen(true);
    };

    const handleOpenQuickUpload = (subAccessId?: string) => {
        setTargetSubAccessId(subAccessId || null);
        setIsQuickUploadOpen(true);
    };

    const handleOpenEditSubAccess = (sub: any) => {
        setSubAccessToEdit(sub);
        setTargetModuleId(sub.moduleId);
        setIsManageSubAccessOpen(true);
    };

    const handleOpenNewSubAccess = (moduleId?: string) => {
        setSubAccessToEdit(null);
        setTargetModuleId(moduleId || null);
        setIsManageSubAccessOpen(true);
    };

    const handleAssignDocToSubAccess = async (docId: string, subAccessId: string) => {
        if (!subAccessId) return;
        try {
            const res = await safeApiRequest(`/api/documentos/${docId}`, {
                method: 'PUT',
                body: JSON.stringify({
                    subAccessId,
                    userId: user?.id,
                    userName: user?.nombreCompleto || user?.nombre
                })
            });
            if (res.ok) {
                showToast('Documento clasificado exitosamente en el sub-acceso', 'success');
                loadData();
            } else {
                const err = await res.json();
                showToast(err.error || 'Error al clasificar documento', 'error');
            }
        } catch (e) {
            console.error(e);
            showToast('Error de red al clasificar', 'error');
        }
    };

    const handleDeleteDoc = (docId: string, codigo: string, titulo: string) => {
        setDocToDelete({ id: docId, codigo, titulo });
    };

    const executeDeleteDoc = async () => {
        if (!docToDelete) return;
        try {
            const res = await safeApiRequest(`/api/documentos/${docToDelete.id}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                cachedLibraryDocs = null;
                showToast(`Documento ${docToDelete.codigo} e historial eliminados correctamente`, 'success');
                setDocToDelete(null);
                loadData();
            } else {
                const err = await res.json();
                showToast(err.error || 'Error al eliminar documento', 'error');
            }
        } catch (e) {
            console.error(e);
            showToast('Error de red al eliminar documento', 'error');
        }
    };

    const handleSort = (col: 'codigo' | 'titulo' | 'version' | 'tipo' | 'estado' | 'vencimiento') => {
        if (sortColumn === col) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(col);
            setSortDirection('asc');
        }
    };

    const isFilterActive = statusFilter !== 'all' || selectedModuleFilter !== 'all' || Boolean(searchQuery.trim());

    // Filtered documents
    const filteredDocs = useMemo(() => {
        return docs.filter(doc => {
            if (selectedModuleFilter !== 'all') {
                if (selectedModuleFilter === 'unassigned') {
                    if (doc.subAccessId) return false;
                } else if (doc.subAccess?.module?.codigo !== selectedModuleFilter && doc.subAccess?.moduleId !== selectedModuleFilter) {
                    return false;
                }
            }
            if (statusFilter !== 'all') {
                const docStatus = (doc.estado || '').toLowerCase().trim();
                const targetStatus = statusFilter.toLowerCase().trim();
                if (docStatus !== targetStatus) {
                    return false;
                }
            }
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const matchesCode = doc.codigoDocumental?.toLowerCase().includes(q);
                const matchesTitle = doc.titulo?.toLowerCase().includes(q);
                const matchesArea = doc.area?.toLowerCase().includes(q);
                const matchesTipo = doc.tipoDocumento?.toLowerCase().includes(q);
                const matchesSub = doc.subAccess?.nombre?.toLowerCase().includes(q) || doc.subAccess?.codigo?.toLowerCase().includes(q);
                if (!matchesCode && !matchesTitle && !matchesArea && !matchesTipo && !matchesSub) return false;
            }
            return true;
        });
    }, [docs, selectedModuleFilter, statusFilter, searchQuery]);

    // Sorted documents for dense auditor table view
    const sortedTableDocs = useMemo(() => {
        return [...filteredDocs].sort((a, b) => {
            let valA: any = '';
            let valB: any = '';
            switch (sortColumn) {
                case 'codigo':
                    valA = a.codigoDocumental || '';
                    valB = b.codigoDocumental || '';
                    break;
                case 'titulo':
                    valA = (a.titulo || '').toLowerCase();
                    valB = (b.titulo || '').toLowerCase();
                    break;
                case 'version':
                    valA = (a.versionMayor || 0) * 1000 + (a.versionMenor || 0);
                    valB = (b.versionMayor || 0) * 1000 + (b.versionMenor || 0);
                    break;
                case 'tipo':
                    valA = (a.tipoDocumento || '') + (a.area || '');
                    valB = (b.tipoDocumento || '') + (b.area || '');
                    break;
                case 'estado':
                    valA = a.estado || '';
                    valB = b.estado || '';
                    break;
                case 'vencimiento':
                    valA = a.proximaRevision ? new Date(a.proximaRevision).getTime() : 0;
                    valB = b.proximaRevision ? new Date(b.proximaRevision).getTime() : 0;
                    break;
                default:
                    valA = a.codigoDocumental || '';
                    valB = b.codigoDocumental || '';
            }
            if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }, [filteredDocs, sortColumn, sortDirection]);

    // Unassigned documents (filtered & total)
    const unassignedDocs = useMemo(() => {
        return filteredDocs.filter(d => !d.subAccessId);
    }, [filteredDocs]);

    const totalUnassignedCount = useMemo(() => {
        return docs.filter(d => !d.subAccessId).length;
    }, [docs]);

    // Total documents count stats
    const stats = useMemo(() => {
        const total = docs.length;
        const vigentes = docs.filter(d => (d.estado || '').toLowerCase() === 'vigente').length;
        const enRevision = docs.filter(d => ['en_revision', 'revision', 'borrador'].includes((d.estado || '').toLowerCase())).length;
        const obsoletos = docs.filter(d => (d.estado || '').toLowerCase() === 'obsoleto').length;
        return { total, vigentes, enRevision, obsoletos };
    }, [docs]);

    const getModuleTheme = (codigo: string) => {
        if (codigo === '1') {
            return {
                bgGradient: 'bg-indigo-500/5',
                borderColor: 'border-indigo-500/30 dark:border-indigo-500/20',
                badgeBg: 'bg-indigo-600 text-white',
                titleColor: 'text-indigo-950 dark:text-indigo-100',
                iconBg: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
                IconComp: Compass
            };
        }
        if (codigo === '2') {
            return {
                bgGradient: 'bg-emerald-500/5',
                borderColor: 'border-emerald-500/30 dark:border-emerald-500/20',
                badgeBg: 'bg-emerald-600 text-white',
                titleColor: 'text-emerald-950 dark:text-emerald-100',
                iconBg: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
                IconComp: Layers
            };
        }
        return {
            bgGradient: 'bg-amber-500/5',
            borderColor: 'border-amber-500/30 dark:border-amber-500/20',
            badgeBg: 'bg-amber-600 text-white',
            titleColor: 'text-amber-950 dark:text-amber-100',
            iconBg: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
            IconComp: LifeBuoy
        };
    };

    return (
        <div className="space-y-6">
            {/* Top Overview & Action Bar */}
            <div className="bg-card text-card-foreground p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Title & Stats */}
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            <span className="p-2 rounded-2xl bg-primary/10 text-primary">
                                <FolderTree className="w-5 h-5" />
                            </span>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                                Estructura de Control Documental SGI (ISO 9001)
                            </h2>
                        </div>
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 pl-11">
                            {stats.total} documentos registrados • {stats.vigentes} vigentes • {modules.length} módulos de procesos
                        </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            onClick={() => handleOpenNewDoc()}
                            className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-2xl font-bold text-xs hover:bg-primary-hover transition-all"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Nuevo Documento</span>
                        </button>

                        <button
                            onClick={() => handleOpenQuickUpload()}
                            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-2xl font-bold text-xs transition-all"
                        >
                            <UploadCloud className="w-4 h-4" />
                            <span>Subir Archivo Rápido</span>
                        </button>

                        <button
                            onClick={() => handleOpenNewSubAccess()}
                            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-3.5 py-2.5 rounded-2xl font-bold text-xs transition-all"
                            title="Gestionar módulos y sub-accesos"
                        >
                            <Settings2 className="w-4 h-4" />
                            <span className="hidden sm:inline">Gestionar Sub-accesos</span>
                        </button>
                    </div>
                </div>

                {/* Filter and View Toggles Bar */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                    {/* View Switcher */}
                    <div 
                        className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl w-full md:w-auto"
                        role="tablist"
                        aria-label="Modo de visualización de biblioteca"
                    >
                        <button
                            role="tab"
                            aria-selected={viewMode === 'structured'}
                            tabIndex={viewMode === 'structured' ? 0 : -1}
                            onClick={() => setViewMode('structured')}
                            className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                viewMode === 'structured'
                                    ? 'bg-card text-card-foreground text-primary shadow-xs'
                                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                        >
                            <FolderTree className="w-4 h-4" />
                            <span>Vista Procesos y Accesos</span>
                        </button>
                        <button
                            role="tab"
                            aria-selected={viewMode === 'grid'}
                            tabIndex={viewMode === 'grid' ? 0 : -1}
                            onClick={() => setViewMode('grid')}
                            className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                viewMode === 'grid'
                                    ? 'bg-card text-card-foreground text-primary shadow-xs'
                                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                        >
                            <LayoutGrid className="w-4 h-4" />
                            <span>Catálogo ({filteredDocs.length})</span>
                        </button>
                        <button
                            role="tab"
                            aria-selected={viewMode === 'table'}
                            tabIndex={viewMode === 'table' ? 0 : -1}
                            onClick={() => setViewMode('table')}
                            className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                viewMode === 'table'
                                    ? 'bg-card text-card-foreground text-primary shadow-xs'
                                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                        >
                            <Table className="w-4 h-4" />
                            <span>Auditoría / Tabla ({filteredDocs.length})</span>
                        </button>
                    </div>

                    {/* Search & Status Filter */}
                    <div className="flex items-center gap-2 w-full md:w-auto flex-1 md:max-w-md justify-end">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar por código, título o norma..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-card border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:border-primary"
                            />
                        </div>

                        <select
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value)}
                            className="px-3 py-2 bg-background border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:border-primary"
                        >
                            <option value="all">Todos los estados</option>
                            <option value="vigente">Vigentes</option>
                            <option value="en_revision">En Revisión</option>
                            <option value="borrador">Borradores</option>
                            <option value="obsoleto">Obsoletos</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-24 space-y-3">
                    <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                    <p className="text-xs font-bold text-slate-400">Cargando biblioteca documental y procesos SGI...</p>
                </div>
            ) : viewMode === 'structured' ? (
                /* ════════════════════════════════════════════════════════════════════════
                   STRUCTURED PROCESS & SUB-ACCESS VIEW (3 MAIN MODULE PANELS)
                   ════════════════════════════════════════════════════════════════════════ */
                <div className="space-y-6">
                    {modules.map(mod => {
                        const theme = getModuleTheme(mod.codigo);
                        const isExpanded = expandedModules[mod.codigo] !== false;
                        const ModIconComp = theme.IconComp;

                        // Sub-access IDs belonging to this module
                        const modSubAccessIds = new Set(mod.subAccesses.map((s: any) => s.id));
                        const modFilteredDocs = filteredDocs.filter(d => d.subAccessId && modSubAccessIds.has(d.subAccessId));
                        const modTotalDocs = docs.filter(d => d.subAccessId && modSubAccessIds.has(d.subAccessId));

                        return (
                            <div
                                key={mod.id}
                                className={`rounded-3xl border ${theme.borderColor} bg-card text-card-foreground shadow-sm overflow-hidden transition-all`}
                            >
                                {/* Module Banner Header */}
                                <div
                                    className={`px-6 py-4 ${theme.bgGradient} flex items-center justify-between gap-4 cursor-pointer select-none border-b border-slate-100 dark:border-slate-800/80 outline-none focus-visible:ring-2 focus-visible:ring-primary`}
                                    onClick={() => toggleModuleExpand(mod.codigo)}
                                    role="button"
                                    tabIndex={0}
                                    aria-expanded={isExpanded}
                                    aria-controls={`module-panel-${mod.codigo}`}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            toggleModuleExpand(mod.codigo);
                                        }
                                    }}
                                >
                                    <div className="flex items-center gap-3.5 min-w-0">
                                        <div className={`w-11 h-11 rounded-2xl ${theme.iconBg} flex items-center justify-center font-bold shrink-0 shadow-xs`}>
                                            <ModIconComp className="w-5 h-5" />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[11px] font-semibold uppercase font-mono px-2 py-0.5 rounded-lg ${theme.badgeBg} shadow-sm`}>
                                                    Módulo {mod.codigo}
                                                </span>
                                                <h3 className={`text-base font-bold ${theme.titleColor} truncate`}>
                                                    {mod.nombre}
                                                </h3>
                                            </div>
                                            {mod.descripcion && (
                                                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-2xl">
                                                    {mod.descripcion}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 shrink-0">
                                        <div className="text-right hidden sm:block">
                                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                                {mod.subAccesses.length} Sub-accesos
                                            </span>
                                            <p className="text-[11px] font-bold text-slate-400">
                                                {isFilterActive
                                                    ? `${modFilteredDocs.length} de ${modTotalDocs.length} docs`
                                                    : `${modTotalDocs.length} documentos`}
                                            </p>
                                        </div>
                                        <div
                                            className="p-2 rounded-xl text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                            aria-hidden="true"
                                        >
                                            {isExpanded ? (
                                                <ChevronDown className="w-5 h-5" />
                                            ) : (
                                                <ChevronRight className="w-5 h-5" />
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Sub-accesses Grid */}
                                {isExpanded && (
                                    <div id={`module-panel-${mod.codigo}`} className="p-6 bg-slate-50/50 dark:bg-slate-900/30 space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                            {mod.subAccesses.map((sub: any) => {
                                                const SubIcon = getSubAccessIcon(sub.icon);
                                                const subDocs: any[] = filteredDocs.filter(d => d.subAccessId === sub.id);
                                                const subTotalDocs: any[] = docs.filter(d => d.subAccessId === sub.id);

                                                return (
                                                    <div
                                                        key={sub.id}
                                                        className="bg-card text-card-foreground rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md transition-all flex flex-col overflow-hidden group"
                                                    >
                                                        {/* Sub-Access Card Top */}
                                                        <div className="p-4 border-b border-slate-100 dark:border-slate-800 space-y-2">
                                                            <div className="flex items-start justify-between gap-2">
                                                                <div className="flex items-center gap-2 min-w-0">
                                                                    <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                                                        <SubIcon className="w-4 h-4" />
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <div className="flex items-center gap-1.5">
                                                                            <span className="text-[11px] font-mono font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                                                                                {sub.codigo}
                                                                            </span>
                                                                            <span className="text-[11px] font-bold text-slate-400">
                                                                                {isFilterActive
                                                                                    ? `(${subDocs.length}/${subTotalDocs.length})`
                                                                                    : `(${subTotalDocs.length})`}
                                                                            </span>
                                                                        </div>
                                                                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate leading-snug mt-0.5">
                                                                            {sub.nombre}
                                                                        </h4>
                                                                    </div>
                                                                </div>

                                                                {/* Edit Sub-access button */}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleOpenEditSubAccess(sub)}
                                                                    className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                                                                    title="Editar configuración del sub-acceso"
                                                                >
                                                                    <Edit2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>

                                                            {/* Standard Description / Typical Documents */}
                                                            {sub.descripcion && (
                                                                <div className="p-2 bg-muted/40 rounded-xl border border-slate-100 dark:border-slate-800/60">
                                                                    <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-3">
                                                                        {sub.descripcion}
                                                                    </p>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Documents List inside Sub-Access */}
                                                        <div className="p-3 flex-1 flex flex-col justify-between space-y-2">
                                                            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                                                {subDocs.length > 0 ? (
                                                                    subDocs.map(doc => {
                                                                        const isVigente = (doc.estado || '').toLowerCase() === 'vigente';
                                                                        const isObsoleto = (doc.estado || '').toLowerCase() === 'obsoleto';
                                                                        const hasFile = doc.versions?.[0]?.files?.length > 0;
                                                                        return (
                                                                            <div
                                                                                key={doc.id}
                                                                                onClick={() => setSelectedDocId(doc.id)}
                                                                                className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-primary/5 hover:border-primary/40 border border-transparent transition-all cursor-pointer flex items-center justify-between gap-2 group/item"
                                                                            >
                                                                                <div className="min-w-0 flex-1">
                                                                                    <div className="flex items-center gap-1.5">
                                                                                        <span className="text-[11px] font-mono font-bold text-slate-500">
                                                                                            {doc.codigoDocumental}
                                                                                        </span>
                                                                                        <span
                                                                                            className={`text-[11px] font-semibold uppercase px-1.5 py-0.2 rounded ${
                                                                                                isVigente
                                                                                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                                                                                                    : isObsoleto
                                                                                                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400'
                                                                                                    : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                                                                                            }`}
                                                                                        >
                                                                                            {doc.estado}
                                                                                        </span>
                                                                                    </div>
                                                                                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate mt-0.5">
                                                                                        {doc.titulo}
                                                                                    </p>
                                                                                </div>

                                                                                <div className="flex items-center gap-1.5 shrink-0 text-slate-400">
                                                                                    {hasFile && (
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={(e) => {
                                                                                                e.stopPropagation();
                                                                                                window.open(`/api/documentos/${doc.id}/view`, '_blank');
                                                                                            }}
                                                                                            className="p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-lg transition-colors"
                                                                                            title="Visualizar documento adjunto online"
                                                                                        >
                                                                                            <Eye className="w-3.5 h-3.5 text-emerald-500" />
                                                                                        </button>
                                                                                    )}
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            handleDeleteDoc(doc.id, doc.codigoDocumental, doc.titulo);
                                                                                        }}
                                                                                        className="opacity-0 group-hover/item:opacity-100 p-1 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-all"
                                                                                        title="Eliminar documento e historial sin registro"
                                                                                    >
                                                                                        <Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-rose-500" />
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })
                                                                ) : subTotalDocs.length > 0 && isFilterActive ? (
                                                                    <div className="py-4 text-center space-y-1 bg-muted/20 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                                                                        <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                                                                            0 coincidentes con el filtro
                                                                        </p>
                                                                        <p className="text-[11px] text-slate-400">
                                                                            {subTotalDocs.length} doc(s) con otros estados
                                                                        </p>
                                                                    </div>
                                                                ) : (
                                                                    <div className="py-4 text-center space-y-1">
                                                                        <p className="text-[11px] font-bold text-slate-400">
                                                                            Sin documentos cargados en este acceso
                                                                        </p>
                                                                        <p className="text-[11px] text-slate-400">
                                                                            Crea un documento o sube un archivo propio
                                                                        </p>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Card Action Buttons */}
                                                            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1.5">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleOpenNewDoc(sub.id)}
                                                                    className="flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl bg-primary/10 hover:bg-primary text-primary hover:text-white text-[11px] font-bold transition-all"
                                                                >
                                                                    <Plus className="w-3 h-3" />
                                                                    <span>Crear Doc</span>
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleOpenQuickUpload(sub.id)}
                                                                    className="flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-600 text-emerald-600 dark:text-emerald-400 hover:text-white text-[11px] font-bold transition-all"
                                                                >
                                                                    <UploadCloud className="w-3 h-3" />
                                                                    <span>Subir Archivo</span>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Bottom Action for Module */}
                                        <div className="pt-2 flex justify-end">
                                            <button
                                                type="button"
                                                onClick={() => handleOpenNewSubAccess(mod.id)}
                                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-primary hover:bg-card border border-dashed border-slate-300 dark:border-slate-700 transition-all"
                                            >
                                                <FolderPlus className="w-3.5 h-3.5" />
                                                <span>+ Agregar Sub-acceso al Módulo {mod.codigo}</span>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* Unassigned Documents Section (if any) */}
                    {unassignedDocs.length > 0 && (
                        <div className="rounded-3xl border border-slate-300 dark:border-slate-700 bg-card p-5 space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="p-1.5 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-600 font-bold">
                                        <HelpCircle className="w-4 h-4" />
                                    </span>
                                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                        Documentos sin Sub-acceso Asignado ({unassignedDocs.length}{isFilterActive ? ` de ${totalUnassignedCount}` : ''})
                                    </h3>
                                </div>
                                <span className="text-xs text-slate-400">
                                    Haz clic para visualizar o clasificar
                                </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {unassignedDocs.map(doc => (
                                    <div
                                        key={doc.id}
                                        onClick={() => setSelectedDocId(doc.id)}
                                        className="p-3.5 rounded-2xl bg-muted/40 hover:bg-muted/70 border border-slate-200 dark:border-slate-800 transition-all cursor-pointer flex flex-col justify-between gap-3 group"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0 flex-1">
                                                <span className="text-[11px] font-mono font-bold text-slate-500">
                                                    {doc.codigoDocumental}
                                                </span>
                                                <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate mt-0.5">
                                                    {doc.titulo}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0 mt-0.5">
                                                {doc.versions?.[0]?.files?.length > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            window.open(`/api/documentos/${doc.id}/view`, '_blank');
                                                        }}
                                                        className="p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-lg transition-colors"
                                                        title="Visualizar documento online"
                                                        aria-label={`Visualizar documento online: ${doc.codigoDocumental}`}
                                                    >
                                                        <Eye className="w-3.5 h-3.5 text-emerald-500" />
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteDoc(doc.id, doc.codigoDocumental, doc.titulo);
                                                    }}
                                                    className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors"
                                                    title="Eliminar documento e historial sin registro"
                                                    aria-label={`Eliminar documento ${doc.codigoDocumental} e historial sin registro`}
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/80" onClick={e => e.stopPropagation()}>
                                            <label className="block mb-1 text-[13px] font-medium text-slate-700 dark:text-slate-200">
                                                Clasificar en:
                                            </label>
                                            <select
                                                defaultValue=""
                                                onChange={e => {
                                                    if (e.target.value) {
                                                        handleAssignDocToSubAccess(doc.id, e.target.value);
                                                    }
                                                }}
                                                className="w-full px-2.5 py-1.5 bg-card text-card-foreground border border-slate-200 dark:border-slate-700 rounded-xl text-[11px] font-bold outline-none focus:border-primary cursor-pointer hover:border-primary/50 transition-colors"
                                            >
                                                <option value="" disabled>Seleccionar Sub-acceso...</option>
                                                {modules.map(mod => (
                                                    <optgroup key={mod.id} label={`Módulo ${mod.codigo}: ${mod.nombre}`}>
                                                        {mod.subAccesses.map((sub: any) => (
                                                            <option key={sub.id} value={sub.id}>
                                                                {sub.codigo} - {sub.nombre}
                                                            </option>
                                                        ))}
                                                    </optgroup>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ) : viewMode === 'table' ? (
                /* ════════════════════════════════════════════════════════════════════════
                   DENSE AUDIT TABLE VIEW (FOR QMS AUDITORS & MANAGERS)
                   ════════════════════════════════════════════════════════════════════════ */
                <div className="bg-card text-card-foreground rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-in fade-in duration-200">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 font-semibold text-slate-500 uppercase tracking-wider text-[11px] select-none">
                                    <th 
                                        className="py-3 px-4 cursor-pointer hover:text-primary transition-colors"
                                        onClick={() => handleSort('codigo')}
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <span>Código</span>
                                            {sortColumn === 'codigo' ? (
                                                sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-primary" /> : <ArrowDown className="w-3.5 h-3.5 text-primary" />
                                            ) : <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />}
                                        </div>
                                    </th>
                                    <th 
                                        className="py-3 px-4 cursor-pointer hover:text-primary transition-colors"
                                        onClick={() => handleSort('titulo')}
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <span>Título del Documento</span>
                                            {sortColumn === 'titulo' ? (
                                                sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-primary" /> : <ArrowDown className="w-3.5 h-3.5 text-primary" />
                                            ) : <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />}
                                        </div>
                                    </th>
                                    <th 
                                        className="py-3 px-3 cursor-pointer hover:text-primary transition-colors text-center"
                                        onClick={() => handleSort('version')}
                                    >
                                        <div className="flex items-center justify-center gap-1.5">
                                            <span>Versión</span>
                                            {sortColumn === 'version' ? (
                                                sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-primary" /> : <ArrowDown className="w-3.5 h-3.5 text-primary" />
                                            ) : <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />}
                                        </div>
                                    </th>
                                    <th 
                                        className="py-3 px-3 cursor-pointer hover:text-primary transition-colors text-center"
                                        onClick={() => handleSort('tipo')}
                                    >
                                        <div className="flex items-center justify-center gap-1.5">
                                            <span>Tipo / Área</span>
                                            {sortColumn === 'tipo' ? (
                                                sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-primary" /> : <ArrowDown className="w-3.5 h-3.5 text-primary" />
                                            ) : <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />}
                                        </div>
                                    </th>
                                    <th className="py-3 px-3">
                                        <span>Proceso / Sub-acceso</span>
                                    </th>
                                    <th 
                                        className="py-3 px-3 cursor-pointer hover:text-primary transition-colors text-center"
                                        onClick={() => handleSort('estado')}
                                    >
                                        <div className="flex items-center justify-center gap-1.5">
                                            <span>Estado</span>
                                            {sortColumn === 'estado' ? (
                                                sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-primary" /> : <ArrowDown className="w-3.5 h-3.5 text-primary" />
                                            ) : <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />}
                                        </div>
                                    </th>
                                    <th 
                                        className="py-3 px-3 cursor-pointer hover:text-primary transition-colors"
                                        onClick={() => handleSort('vencimiento')}
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <span>Próxima Revisión</span>
                                            {sortColumn === 'vencimiento' ? (
                                                sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-primary" /> : <ArrowDown className="w-3.5 h-3.5 text-primary" />
                                            ) : <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />}
                                        </div>
                                    </th>
                                    <th className="py-3 px-4 text-right">
                                        <span>Acciones</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {sortedTableDocs.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="py-12 text-center text-slate-400">
                                            No se encontraron documentos con los filtros seleccionados.
                                        </td>
                                    </tr>
                                ) : (
                                    sortedTableDocs.map((doc) => {
                                        const isVigente = doc.estado === 'vigente';
                                        const hasFile = doc.versions?.[0]?.files?.length > 0;
                                        return (
                                            <tr 
                                                key={doc.id}
                                                className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group cursor-pointer"
                                                onClick={() => setSelectedDocId(doc.id)}
                                            >
                                                <td className="py-3 px-4 font-mono font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                                    <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-[11px]">
                                                        {doc.codigoDocumental}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 min-w-[240px]">
                                                    <div className="font-bold text-slate-800 dark:text-slate-100 text-[13px] group-hover:text-primary transition-colors">
                                                        {doc.titulo}
                                                    </div>
                                                    {doc.requiereConfirmacionLectura && (
                                                        <span className="inline-block mt-0.5 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.2 rounded border border-indigo-200/50">
                                                            Lectura obligatoria
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-3 text-center whitespace-nowrap">
                                                    <span className="font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[11px]">
                                                        v{doc.versionMayor}.{doc.versionMenor}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-3 text-center whitespace-nowrap">
                                                    <span className="text-[11px] font-semibold text-slate-500">
                                                        {doc.tipoDocumento} / {doc.area}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-3 text-[11px] text-slate-600 dark:text-slate-400 max-w-[180px] truncate">
                                                    {doc.subAccess ? (
                                                        <span className="font-medium text-primary">
                                                            {doc.subAccess.codigo} {doc.subAccess.nombre}
                                                        </span>
                                                    ) : (
                                                        <span className="text-amber-600 dark:text-amber-400 italic">
                                                            Sin Asignar
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-3 text-center whitespace-nowrap">
                                                    <span className={`text-[11px] font-semibold uppercase px-2 py-0.5 rounded ${
                                                        isVigente
                                                            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400'
                                                            : doc.estado === 'borrador'
                                                            ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                                                            : 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400'
                                                    }`}>
                                                        {doc.estado}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-3 text-slate-500 whitespace-nowrap text-[11px]">
                                                    {doc.proximaRevision 
                                                        ? new Date(doc.proximaRevision).toLocaleDateString() 
                                                        : 'No programada'}
                                                </td>
                                                <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        {hasFile && (
                                                            <button
                                                                type="button"
                                                                onClick={() => window.open(`/api/documentos/${doc.id}/view`, '_blank')}
                                                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition-colors"
                                                                title="Visualizar archivo"
                                                                aria-label={`Visualizar archivo de ${doc.codigoDocumental}`}
                                                            >
                                                                <Eye className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedDocId(doc.id)}
                                                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-colors"
                                                            title="Ver Detalle"
                                                            aria-label={`Ver detalle del documento ${doc.codigoDocumental}`}
                                                        >
                                                            <Edit2 className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteDoc(doc.id, doc.codigoDocumental, doc.titulo)}
                                                            className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                                                            title="Eliminar documento"
                                                            aria-label={`Eliminar documento ${doc.codigoDocumental}`}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                /* ════════════════════════════════════════════════════════════════════════
                   CATALOG / GRID VIEW (ALL CONTROLLED DOCUMENTS)
                   ════════════════════════════════════════════════════════════════════════ */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredDocs.map(doc => {
                        const isVigente = doc.estado === 'vigente';
                        const sub = doc.subAccess;
                        return (
                            <div
                                key={doc.id}
                                className="bg-card text-card-foreground rounded-3xl p-5 shadow-xs border border-slate-200 dark:border-slate-800 hover:shadow-md transition-all flex flex-col justify-between space-y-4 group"
                            >
                                <div>
                                    <div className="flex justify-between items-start mb-2.5">
                                        <span className="text-[11px] font-bold font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-600 dark:text-slate-300">
                                            {doc.codigoDocumental}
                                        </span>
                                        <span
                                            className={`text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${
                                                isVigente
                                                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400'
                                                    : doc.estado === 'borrador'
                                                    ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                                                    : 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400'
                                            }`}
                                        >
                                            {doc.estado}
                                        </span>
                                    </div>

                                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base mb-1 line-clamp-2">
                                        {doc.titulo}
                                    </h3>

                                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                        <span className="text-[11px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                                            {doc.tipoDocumento} • {doc.area}
                                        </span>
                                        {sub && (
                                            <span className="text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded truncate max-w-[200px]">
                                                {sub.codigo} {sub.nombre}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                                    <span className="text-xs font-bold text-slate-400">
                                        v{doc.versionActual || `${doc.versionMayor}.${doc.versionMenor}`}
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                        {doc.versions?.[0]?.files?.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => window.open(`/api/documentos/${doc.id}/view`, '_blank')}
                                                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded-xl transition-colors"
                                                title="Visualizar documento online"
                                            >
                                                <Eye className="w-3.5 h-3.5 text-emerald-500" />
                                                <span className="hidden sm:inline">Ver Online</span>
                                            </button>
                                        )}
                                        <button
                                            onClick={() => setSelectedDocId(doc.id)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/10 rounded-xl transition-colors"
                                        >
                                            <Eye className="w-3.5 h-3.5" />
                                            <span>Detalle</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteDoc(doc.id, doc.codigoDocumental, doc.titulo)}
                                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-colors"
                                            title="Eliminar documento e historial sin registro"
                                        >
                                            <Trash2 className="w-4 h-4 hover:text-rose-500" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {filteredDocs.length === 0 && (
                        <div className="col-span-full text-center py-16 bg-card rounded-3xl border border-slate-200 dark:border-slate-800 p-8 space-y-3">
                            <FileText className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600" />
                            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                No se encontraron documentos
                            </h4>
                            <p className="text-xs text-slate-400">
                                Intenta con otros términos de búsqueda o filtros
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Document Detail Modal */}
            {selectedDocId && (
                <DocumentDetailModal
                    documentId={selectedDocId}
                    onClose={() => {
                        setSelectedDocId(null);
                        loadData();
                    }}
                    user={user}
                />
            )}

            {/* Structured New Document Modal */}
            {isNewModalOpen && (
                <NewDocumentModal
                    user={user}
                    initialSubAccessId={targetSubAccessId}
                    onClose={() => setIsNewModalOpen(false)}
                    onSuccess={id => {
                        setIsNewModalOpen(false);
                        loadData();
                        setSelectedDocId(id);
                    }}
                />
            )}

            {/* Quick Upload Modal */}
            {isQuickUploadOpen && (
                <QuickUploadDocModal
                    modules={modules}
                    initialSubAccessId={targetSubAccessId}
                    user={user}
                    onClose={() => setIsQuickUploadOpen(false)}
                    onSuccess={id => {
                        setIsQuickUploadOpen(false);
                        loadData();
                        setSelectedDocId(id);
                    }}
                />
            )}

            {/* Manage Sub-accesses Modal */}
            {isManageSubAccessOpen && (
                <ManageSubAccessModal
                    modules={modules}
                    user={user}
                    initialSubAccessToEdit={subAccessToEdit}
                    initialModuleId={targetModuleId}
                    onClose={() => setIsManageSubAccessOpen(false)}
                    onRefresh={() => {
                        loadData();
                    }}
                />
            )}

            <ConfirmModal
                isOpen={Boolean(docToDelete)}
                onClose={() => setDocToDelete(null)}
                onConfirm={executeDeleteDoc}
                title="Eliminar Documento Controlado"
                message={`¿Está seguro de eliminar definitivamente el documento "${docToDelete?.codigo}: ${docToDelete?.titulo}" y TODO su historial de revisiones?\n\nEsta acción no dejará registros en el sistema.`}
                confirmText="Eliminar Definitivamente"
                cancelText="Cancelar"
                isDestructive={true}
            />
        </div>
    );
}
