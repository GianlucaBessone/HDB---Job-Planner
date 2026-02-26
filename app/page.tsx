'use client';

import { useState, useEffect, useCallback } from 'react';
import { formatWhatsAppMessage } from '@/lib/whatsappFormatter';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { showToast } from '@/components/Toast';
import { usePlanningStore } from '@/lib/store/usePlanningStore';
import {
    Calendar as CalendarIcon,
    Plus,
    Save,
    Copy,
    MessageCircle,
    Trash2,
    Clock,
    Users as UsersIcon,
    AlertCircle,
    Files,
    Star,
    ChevronUp,
    ChevronDown,
    StickyNote,
    X,
    PanelLeftOpen,
    Send
} from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';

export default function PlanningPage() {
    const {
        fecha: storeFecha,
        setFecha: setStoreFecha,
        blocksByDate,
        setBlocksForDate
    } = usePlanningStore();

    const [isHydrated, setIsHydrated] = useState(false);
    const [projects, setProjects] = useState<any[]>([]);
    const [operators, setOperators] = useState<any[]>([]);
    const [favorites, setFavorites] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [duplicateDate, setDuplicateDate] = useState('');

    // Hydration fix for client-side persistence
    useEffect(() => {
        setIsHydrated(true);
        if (!storeFecha) {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            setStoreFecha(format(tomorrow, 'yyyy-MM-dd'));
        }
    }, [storeFecha, setStoreFecha]);

    // Use store values
    const fecha = storeFecha || '';
    const blocks = blocksByDate[fecha] || [];

    // Helper to update blocks for current fecha
    const setBlocks = (update: any[] | ((prev: any[]) => any[])) => {
        const nextBlocks = typeof update === 'function' ? update(blocks) : update;
        setBlocksForDate(fecha, nextBlocks);
    };

    // Mobile panels
    const [showWhatsApp, setShowWhatsApp] = useState(false);
    const [showFavorites, setShowFavorites] = useState(false);
    const [expandedIndices, setExpandedIndices] = useState<number[]>([]);

    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [favoriteToDelete, setFavoriteToDelete] = useState<string | null>(null);

    const loadPlanning = useCallback(async () => {
        if (!fecha) return;

        // If we already have blocks for this date in the store and we ARE hydrated,
        // we might want to skip the API call if we want to keep unsaved changes.
        // However, we should fetch at least once per session per date.
        // For now, let's keep the logic: if blocks exist in store, don't overwrite.
        if (blocks.length > 0) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        try {
            const data = await fetch(`/api/planning?fecha=${fecha}&t=${Date.now()}`).then(res => res.json());
            if (data && data.blocks) {
                setBlocks(data.blocks);
            } else {
                setBlocks([]);
            }
        } catch (error) {
            console.error('Error loading planning:', error);
        } finally {
            setIsLoading(false);
        }
    }, [fecha, blocks.length]); // eslint-disable-line react-hooks/exhaustive-deps

    const loadData = useCallback(async () => {
        try {
            const [p, o, f] = await Promise.all([
                fetch('/api/projects').then(res => res.json()),
                fetch('/api/operators').then(res => res.json()),
                fetch('/api/favorites').then(res => res.json())
            ]);
            setProjects(p.filter((x: any) => x.activo));
            setOperators(o.filter((x: any) => x.activo));
            setFavorites(f);
        } catch (error) {
            console.error('Error loading static data:', error);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);
    useEffect(() => {
        if (isHydrated) loadPlanning();
    }, [loadPlanning, isHydrated]);

    const addBlock = (type: 'work' | 'note' = 'work') => {
        const newBlock = type === 'work' ? {
            projectId: '',
            projectName: '',
            startTime: '08:00',
            endTime: '',
            note: '',
            operatorIds: [],
            operatorNames: [],
            isNoteOnly: false
        } : {
            projectId: null,
            projectName: 'Nota',
            startTime: '',
            note: '',
            operatorIds: [],
            operatorNames: [],
            isNoteOnly: true
        };
        setBlocks(prev => [...prev, newBlock]);
    };

    const removeBlock = (indexToDelete: number) => {
        setBlocks(prev => prev.filter((_, index) => index !== indexToDelete));
    };

    const updateBlock = (index: number, field: string, value: any) => {
        setBlocks(prev => {
            const newBlocks = [...prev];
            const updatedBlock = { ...newBlocks[index], [field]: value };
            if (field === 'projectId') {
                const project = projects.find(p => p.id === value);
                updatedBlock.projectName = project ? project.nombre : '';
            }
            if (field === 'operatorIds') {
                updatedBlock.operatorNames = value.map((id: string) => {
                    const op = operators.find(o => o.id === id);
                    return op ? op.nombreCompleto : '';
                });
            }
            newBlocks[index] = updatedBlock;
            return newBlocks;
        });
    };

    const moveBlock = (index: number, direction: 'up' | 'down') => {
        const newBlocks = [...blocks];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= newBlocks.length) return;
        [newBlocks[index], newBlocks[targetIndex]] = [newBlocks[targetIndex], newBlocks[index]];
        setBlocks(newBlocks);
    };

    const saveAsFavorite = async (block: any) => {
        const name = prompt('Nombre del favorito:', block.projectName || 'Bloc de nota');
        if (!name) return;
        const data = { ...block, name };
        const res = await fetch('/api/favorites', {
            method: 'POST',
            body: JSON.stringify(data)
        }).then(res => res.json());
        setFavorites(prev => [...prev, res]);
    };

    const addFromFavorite = (fav: any) => {
        const newBlock = {
            ...fav,
            operatorIds: fav.operatorIds || [],
            operatorNames: fav.operatorNames || [],
            id: undefined
        };
        setBlocks(prev => [...prev, newBlock]);
        setShowFavorites(false);
    };

    const handleDeleteFavoriteClick = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setFavoriteToDelete(id);
        setIsConfirmOpen(true);
    };

    const confirmDeleteFavorite = async () => {
        if (!favoriteToDelete) return;
        const id = favoriteToDelete;
        await fetch(`/api/favorites?id=${id}`, { method: 'DELETE' });
        setFavorites(prev => prev.filter(f => f.id !== id));
        setIsConfirmOpen(false);
        setFavoriteToDelete(null);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await fetch('/api/planning', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fecha, blocks })
            });
            showToast('Planificación guardada con éxito', 'success');
        } catch (error) {
            showToast('Error al guardar', 'error');
        } finally { setIsSaving(false); }
    };

    const handleDuplicate = async () => {
        if (!duplicateDate) return;
        setIsLoading(true);
        try {
            const data = await fetch(`/api/planning?fecha=${duplicateDate}&t=${Date.now()}`).then(res => res.json());
            if (data && data.blocks && data.blocks.length > 0) {
                setBlocks(data.blocks);
                showToast(`Planificación copiada de ${duplicateDate}`, 'success');
            } else { showToast('No se encontró planificación para esa fecha', 'info'); }
        } catch (error) { showToast('Error al duplicar', 'error'); } finally { setIsLoading(false); }
    };

    const whatsappMessage = formatWhatsAppMessage({ date: fecha, blocks });
    const copyToClipboard = () => { navigator.clipboard.writeText(whatsappMessage); showToast('Mensaje copiado al portapapeles', 'success'); };
    const openInWhatsApp = () => { const url = `https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`; window.open(url, '_blank'); };

    // Safety check for display date during hydration
    if (!isHydrated || !fecha) return <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
    </div>;

    const displayDate = format(new Date(fecha + 'T12:00:00'), "EEEE d 'de' MMMM", { locale: es });

    return (
        <div className="w-full space-y-4 md:space-y-8 animate-in fade-in duration-500 pb-20">
            {/* Header / Date Selector — compact on mobile */}
            <div className="bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm shadow-slate-200/50">
                <div className="space-y-1 mb-3">
                    <h2 className="text-lg md:text-2xl font-bold text-slate-900 capitalize italic">{displayDate}</h2>
                    <p className="text-slate-500 text-xs md:text-sm">Gestiona el cronograma de hoy</p>
                </div>

                <div className="flex items-center gap-2">
                    <div className="relative group flex-1">
                        <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                        <input
                            type="date"
                            className="bg-slate-50 border border-slate-200 rounded-xl py-2 pl-10 pr-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all w-full"
                            value={fecha}
                            onChange={e => setStoreFecha(e.target.value)}
                        />
                    </div>
                    <div className="h-8 w-[1px] bg-slate-200 hidden md:block"></div>
                    <input type="date" className="bg-slate-50 border border-slate-200 rounded-xl py-2 px-2 text-xs outline-none flex-1 md:flex-none md:w-40" value={duplicateDate} onChange={e => setDuplicateDate(e.target.value)} />
                    <button onClick={handleDuplicate} className="p-2 text-slate-500 hover:text-primary hover:bg-primary/5 rounded-xl border border-slate-200 transition-colors shrink-0 active:scale-90" title="Copiar de otra fecha">
                        <Files className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-8 items-start">
                {/* Main Editor */}
                <div className="lg:col-span-8 space-y-3 md:space-y-6">
                    {/* Toolbar — compact on mobile */}
                    <div className="flex justify-between items-center px-1">
                        <div className="flex items-center gap-2">
                            {/* Favorites toggle — mobile only */}
                            <button
                                onClick={() => setShowFavorites(true)}
                                className="md:hidden flex items-center gap-1.5 text-slate-500 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 active:scale-95 transition-all"
                            >
                                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                                <span className="hidden xs:inline">Favoritos</span>
                            </button>
                            <h3 className="hidden md:flex font-semibold text-slate-700 items-center gap-2">
                                <Clock className="w-4 h-4 text-primary" /> Bloques de Trabajo
                            </h3>
                        </div>
                        <div className="flex gap-1.5 md:gap-2">
                            <button onClick={() => addBlock('note')} className="flex items-center gap-1.5 bg-slate-100 text-slate-600 px-3 py-2 rounded-xl text-xs font-semibold hover:bg-slate-200 transition-all active:scale-95">
                                <StickyNote className="w-3.5 h-3.5" /> Nota
                            </button>
                            <button onClick={() => addBlock('work')} className="flex items-center gap-1.5 bg-primary text-white px-3 py-2 rounded-xl text-xs font-semibold hover:bg-primary/90 shadow-lg shadow-primary/20 active:scale-95 transition-all">
                                <Plus className="w-3.5 h-3.5" /> Bloque
                            </button>
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 animate-pulse"><div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4"></div><p className="text-slate-400 font-medium">Cargando...</p></div>
                    ) : (
                        <div className="space-y-3 md:space-y-4">
                            {blocks.map((block, index) => {
                                const isCollapsed = !expandedIndices.includes(index);
                                const toggleCollapse = () => {
                                    setExpandedIndices(prev =>
                                        prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
                                    );
                                };

                                return (
                                    <div key={`block-${index}`} className="bg-white rounded-2xl border border-slate-200 shadow-sm relative group hover:border-primary/30 transition-all duration-300 overflow-hidden">
                                        {/* Top Controls & Collapse Trigger */}
                                        <div className="flex items-center px-4 md:px-6 py-3 border-b border-transparent group-hover:bg-slate-50/50 transition-colors">
                                            <div className="flex items-center gap-0.5 shrink-0">
                                                <button
                                                    onClick={() => moveBlock(index, 'up')}
                                                    disabled={index === 0}
                                                    className="p-1 text-slate-300 hover:text-primary hover:bg-primary/5 rounded-lg disabled:opacity-0 transition-all active:scale-90"
                                                >
                                                    <ChevronUp className="w-4 h-4 md:w-5 md:h-5" />
                                                </button>
                                                <button
                                                    onClick={() => moveBlock(index, 'down')}
                                                    disabled={index === blocks.length - 1}
                                                    className="p-1 text-slate-300 hover:text-primary hover:bg-primary/5 rounded-lg disabled:opacity-0 transition-all active:scale-90"
                                                >
                                                    <ChevronDown className="w-4 h-4 md:w-5 md:h-5" />
                                                </button>
                                            </div>

                                            {/* Clickable area for collapse */}
                                            <div
                                                className="flex-1 flex justify-center items-center cursor-pointer h-10 select-none"
                                                onClick={toggleCollapse}
                                            >
                                                {isCollapsed ? (
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-bold text-slate-600 uppercase tracking-tight truncate max-w-[150px] md:max-w-xs px-2 py-1 bg-slate-100 rounded-lg">
                                                            {block.projectName || 'Sin Proyecto'}
                                                        </span>
                                                        <ChevronDown className="w-4 h-4 text-slate-400 animate-bounce-slow" />
                                                    </div>
                                                ) : (
                                                    <div className="w-12 h-1.5 bg-slate-100 rounded-full group-hover:bg-slate-200 transition-colors"></div>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-1 shrink-0">
                                                <button
                                                    onClick={() => saveAsFavorite(block)}
                                                    className="p-2 text-slate-300 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-all active:scale-90"
                                                >
                                                    <Star className="w-4 h-4 md:w-5 md:h-5" />
                                                </button>
                                                <button
                                                    onClick={() => removeBlock(index)}
                                                    className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all active:scale-90"
                                                >
                                                    <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
                                                </button>
                                            </div>
                                        </div>

                                        {!isCollapsed && (
                                            <div className="p-4 md:p-6 pt-2 md:pt-4 animate-in slide-in-from-top-2 duration-200">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                                                    <div className="space-y-3 md:space-y-5">
                                                        <div className="space-y-1.5">
                                                            <label className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider px-1">Tipo / Proyecto</label>
                                                            {block.isNoteOnly ? (
                                                                <div className="w-full bg-slate-100 border border-slate-200 rounded-xl py-2.5 px-3 text-sm text-slate-500 font-bold italic flex items-center gap-2">
                                                                    <StickyNote className="w-4 h-4" /> NOTA LIBRE
                                                                </div>
                                                            ) : (
                                                                <select className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 appearance-auto" value={block.projectId || ''} onChange={e => updateBlock(index, 'projectId', e.target.value)}>
                                                                    <option value="">Seleccionar Proyecto</option>
                                                                    {projects.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                                                                </select>
                                                            )}
                                                        </div>

                                                        {!block.isNoteOnly && (
                                                            <div className="grid grid-cols-2 gap-3">
                                                                <div className="space-y-1.5">
                                                                    <label className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider px-1">Inicio</label>
                                                                    <input type="time" className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-sm text-slate-700 outline-none" value={block.startTime || ''} onChange={e => updateBlock(index, 'startTime', e.target.value)} />
                                                                </div>
                                                                <div className="space-y-1.5">
                                                                    <label className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider px-1">Fin</label>
                                                                    <input type="time" className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-sm text-slate-700 outline-none" value={block.endTime || ''} onChange={e => updateBlock(index, 'endTime', e.target.value)} />
                                                                </div>
                                                            </div>
                                                        )}

                                                        <div className="space-y-1.5">
                                                            <label className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider px-1">{block.isNoteOnly ? 'Contenido de la Nota' : 'Nota / Detalles'}</label>
                                                            <textarea
                                                                placeholder={block.isNoteOnly ? "Escribe tu mensaje aquí..." : "Añade detalles relevantes..."}
                                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 resize-none h-16 md:h-24"
                                                                value={block.note || ''} onChange={e => updateBlock(index, 'note', e.target.value)}
                                                            />
                                                        </div>
                                                    </div>

                                                    {!block.isNoteOnly && (
                                                        <div className="space-y-2">
                                                            <div className="flex justify-between items-center px-1">
                                                                <label className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider">Operadores</label>
                                                                <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{block.operatorIds.length} sel.</span>
                                                            </div>
                                                            <div className="bg-slate-50/50 border border-slate-200 rounded-2xl p-2 md:p-4 max-h-[160px] md:max-h-[250px] overflow-y-auto space-y-0.5 custom-scrollbar overscroll-contain">
                                                                {operators.map(op => {
                                                                    const isSelected = block.operatorIds.includes(op.id);
                                                                    const isFirstBlock = index === 0;
                                                                    const isUsedElsewhere = blocks.some((otherBlock, otherIndex) =>
                                                                        index !== otherIndex && otherBlock.operatorIds.includes(op.id)
                                                                    );
                                                                    let conflictBlock = -1;
                                                                    const hasConflict = isUsedElsewhere && blocks.some((b, i) => {
                                                                        if (i === index || !b.operatorIds.includes(op.id)) return false;
                                                                        if (!b.endTime) { conflictBlock = i + 1; return true; }
                                                                        if (block.startTime && block.startTime < b.endTime) { conflictBlock = i + 1; return true; }
                                                                        return false;
                                                                    });
                                                                    const isDisabled = !isFirstBlock && isUsedElsewhere && !isSelected && (!block.startTime || hasConflict);
                                                                    return (
                                                                        <label key={op.id} className={`flex items-center gap-2 p-2 md:p-3 rounded-xl transition-all text-sm ${isSelected ? 'bg-primary/20 text-primary-dark font-medium border border-primary/20' : isDisabled ? 'opacity-40 cursor-not-allowed bg-slate-50 text-slate-400' : 'hover:bg-slate-100 text-slate-600 border border-transparent cursor-pointer'}`}>
                                                                            <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-primary disabled:cursor-not-allowed shrink-0" checked={isSelected} disabled={isDisabled} onChange={e => {
                                                                                const next = e.target.checked ? [...block.operatorIds, op.id] : block.operatorIds.filter((id: string) => id !== op.id);
                                                                                updateBlock(index, 'operatorIds', next);
                                                                            }} />
                                                                            <div className="flex flex-col min-w-0">
                                                                                <span className="text-xs md:text-sm truncate">{op.nombreCompleto}</span>
                                                                                {isDisabled && !isSelected && <span className="text-[9px] font-bold uppercase text-red-400">{hasConflict ? 'Ocupado' : 'Re-Asignar'}</span>}
                                                                            </div>
                                                                        </label>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Desktop Sidebar — hidden on mobile */}
                <div className="hidden lg:block lg:col-span-4 sticky top-24 space-y-6">
                    {/* WhatsApp Preview */}
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xl space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-extrabold text-slate-800 italic flex items-center gap-2">PREVIEW <span className="text-primary not-italic bg-primary/10 px-2 py-0.5 rounded text-[10px] tracking-widest uppercase">WhatsApp</span></h3>
                        </div>
                        <div className="whatsapp-preview text-xs min-h-[150px]">{whatsappMessage}</div>
                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={copyToClipboard} className="bg-slate-900 text-white p-3 rounded-xl font-bold hover:bg-slate-800 transition-all text-xs flex items-center justify-center gap-2"><Copy className="w-4 h-4" /> Copiar</button>
                            <button onClick={openInWhatsApp} className="bg-[#25D366] text-white p-3 rounded-xl font-bold hover:bg-[#22c35e] transition-all text-xs flex items-center justify-center gap-2"><MessageCircle className="w-4 h-4" /> Abrir</button>
                        </div>
                        <button onClick={handleSave} disabled={isSaving} className="w-full bg-green-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-green-600/10 hover:bg-green-700 transition-all flex items-center justify-center gap-3">
                            {isSaving ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> : <Save className="w-5 h-5" />}
                            {isSaving ? 'Guardando...' : 'Guardar Planificación'}
                        </button>
                    </div>

                    {/* Favorite Blocks */}
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                        <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2 uppercase tracking-tight">
                            <Star className="w-4 h-4 text-amber-500 fill-amber-500" /> Plantillas Favoritas
                        </h3>
                        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                            {favorites.map(fav => (
                                <div key={fav.id} onClick={() => addFromFavorite(fav)} className="p-3 bg-slate-50 border border-slate-200 rounded-2xl hover:border-primary/40 hover:bg-primary/5 cursor-pointer transition-all group flex justify-between items-center">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className={`p-2 rounded-lg ${fav.isNoteOnly ? 'bg-amber-100 text-amber-600' : 'bg-primary/10 text-primary'}`}>
                                            {fav.isNoteOnly ? <StickyNote className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                                        </div>
                                        <div className="truncate">
                                            <p className="text-xs font-bold text-slate-700 truncate">{fav.name}</p>
                                            <p className="text-[10px] text-slate-400 truncate">{fav.isNoteOnly ? 'Tipo: Nota' : `Ref: ${fav.projectName || 'Sin Proyecto'}`}</p>
                                        </div>
                                    </div>
                                    <button onClick={(e) => handleDeleteFavoriteClick(fav.id, e)} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"><X className="w-4 h-4" /></button>
                                </div>
                            ))}
                            {favorites.length === 0 && <p className="text-[11px] text-slate-400 italic text-center py-4">No tienes plantillas guardadas</p>}
                        </div>
                    </div>
                </div>
            </div>

            {/* ============================================ */}
            {/* MOBILE: Floating Action Buttons              */}
            {/* ============================================ */}
            <div className="lg:hidden fixed bottom-20 right-4 z-40 flex flex-col gap-2">
                {/* Save button */}
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="w-12 h-12 bg-green-600 text-white rounded-full shadow-lg shadow-green-600/30 flex items-center justify-center hover:bg-green-700 active:scale-90 transition-all"
                    title="Guardar"
                >
                    {isSaving ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> : <Save className="w-5 h-5" />}
                </button>
                {/* WhatsApp FAB */}
                <button
                    onClick={() => setShowWhatsApp(true)}
                    className="w-12 h-12 bg-[#25D366] text-white rounded-full shadow-lg shadow-[#25D366]/30 flex items-center justify-center hover:bg-[#22c35e] active:scale-90 transition-all"
                    title="WhatsApp Preview"
                >
                    <MessageCircle className="w-5 h-5" />
                </button>
            </div>

            {/* ============================================ */}
            {/* MOBILE: WhatsApp Preview Modal               */}
            {/* ============================================ */}
            {showWhatsApp && (
                <div className="lg:hidden fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowWhatsApp(false)}>
                    <div className="bg-white w-full max-h-[85vh] rounded-t-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300" onClick={e => e.stopPropagation()}>
                        {/* Handle bar */}
                        <div className="flex justify-center pt-3 pb-1">
                            <div className="w-10 h-1 bg-slate-300 rounded-full"></div>
                        </div>
                        <div className="p-5 space-y-4 overflow-y-auto max-h-[calc(85vh-40px)]">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-extrabold text-slate-800 italic flex items-center gap-2">PREVIEW <span className="text-primary not-italic bg-primary/10 px-2 py-0.5 rounded text-[10px] tracking-widest uppercase">WhatsApp</span></h3>
                                <button onClick={() => setShowWhatsApp(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><X className="w-5 h-5" /></button>
                            </div>
                            <div className="whatsapp-preview text-xs min-h-[120px]">{whatsappMessage}</div>
                            <div className="grid grid-cols-2 gap-2">
                                <button onClick={copyToClipboard} className="bg-slate-900 text-white p-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition-all"><Copy className="w-4 h-4" /> Copiar</button>
                                <button onClick={openInWhatsApp} className="bg-[#25D366] text-white p-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition-all"><MessageCircle className="w-4 h-4" /> Abrir WA</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ============================================ */}
            {/* MOBILE: Favorites Slide-in Panel             */}
            {/* ============================================ */}
            {showFavorites && (
                <div className="lg:hidden fixed inset-0 z-[100] flex bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowFavorites(false)}>
                    <div className="bg-white w-[85%] max-w-sm h-full shadow-2xl overflow-hidden animate-in slide-in-from-left duration-300" onClick={e => e.stopPropagation()}>
                        <div className="p-5 h-full flex flex-col">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2 uppercase tracking-tight">
                                    <Star className="w-4 h-4 text-amber-500 fill-amber-500" /> Plantillas Favoritas
                                </h3>
                                <button onClick={() => setShowFavorites(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><X className="w-5 h-5" /></button>
                            </div>
                            <div className="flex-1 overflow-y-auto space-y-2 overscroll-contain">
                                {favorites.map(fav => (
                                    <div key={fav.id} onClick={() => addFromFavorite(fav)} className="p-3 bg-slate-50 border border-slate-200 rounded-2xl hover:border-primary/40 hover:bg-primary/5 cursor-pointer transition-all group flex justify-between items-center active:scale-[0.98]">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className={`p-2 rounded-lg shrink-0 ${fav.isNoteOnly ? 'bg-amber-100 text-amber-600' : 'bg-primary/10 text-primary'}`}>
                                                {fav.isNoteOnly ? <StickyNote className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                                            </div>
                                            <div className="truncate">
                                                <p className="text-xs font-bold text-slate-700 truncate">{fav.name}</p>
                                                <p className="text-[10px] text-slate-400 truncate">{fav.isNoteOnly ? 'Tipo: Nota' : `Ref: ${fav.projectName || 'Sin Proyecto'}`}</p>
                                            </div>
                                        </div>
                                        <button onClick={(e) => handleDeleteFavoriteClick(fav.id, e)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all shrink-0"><X className="w-4 h-4" /></button>
                                    </div>
                                ))}
                                {favorites.length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                                        <Star className="w-10 h-10 mb-3 opacity-20" />
                                        <p className="text-sm font-medium text-slate-500">Sin plantillas</p>
                                        <p className="text-[11px] mt-1">Guarda bloques con la ★ para reutilizarlos</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmDialog
                isOpen={isConfirmOpen}
                title="Eliminar Favorito"
                message="¿Estás seguro de que deseas eliminar esta plantilla favorita?"
                onConfirm={confirmDeleteFavorite}
                onCancel={() => setIsConfirmOpen(false)}
            />
        </div>
    );
}
