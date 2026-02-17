'use client';

import { useState, useEffect, useCallback } from 'react';
import { formatWhatsAppMessage } from '@/lib/whatsappFormatter';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
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
    X
} from 'lucide-react';

export default function PlanningPage() {
    const [fecha, setFecha] = useState(() => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return format(tomorrow, 'yyyy-MM-dd');
    });
    const [blocks, setBlocks] = useState<any[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [operators, setOperators] = useState<any[]>([]);
    const [favorites, setFavorites] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [duplicateDate, setDuplicateDate] = useState('');

    const loadPlanning = useCallback(async () => {
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
    }, [fecha]);

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
    useEffect(() => { loadPlanning(); }, [loadPlanning]);

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
            id: undefined // Remove DB id from favorite
        };
        setBlocks(prev => [...prev, newBlock]);
    };

    const deleteFavorite = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('¿Eliminar favorito?')) return;
        await fetch(`/api/favorites?id=${id}`, { method: 'DELETE' });
        setFavorites(prev => prev.filter(f => f.id !== id));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await fetch('/api/planning', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fecha, blocks })
            });
            await loadPlanning();
            alert('Planificación guardada con éxito');
        } catch (error) {
            alert('Error al guardar');
        } finally { setIsSaving(false); }
    };

    const handleDuplicate = async () => {
        if (!duplicateDate) return;
        setIsLoading(true);
        try {
            const data = await fetch(`/api/planning?fecha=${duplicateDate}&t=${Date.now()}`).then(res => res.json());
            if (data && data.blocks && data.blocks.length > 0) {
                setBlocks(data.blocks);
                alert(`Planificación copiada de ${duplicateDate}`);
            } else { alert('No se encontró planificación para esa fecha'); }
        } catch (error) { alert('Error al duplicar'); } finally { setIsLoading(false); }
    };

    const whatsappMessage = formatWhatsAppMessage({ date: fecha, blocks });
    const copyToClipboard = () => { navigator.clipboard.writeText(whatsappMessage); alert('Mensaje copiado al portapapeles'); };
    const openInWhatsApp = () => { const url = `https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`; window.open(url, '_blank'); };
    const displayDate = format(new Date(fecha + 'T12:00:00'), "EEEE d 'de' MMMM", { locale: es });

    return (
        <div className="w-full space-y-8 animate-in fade-in duration-500 pb-20">
            {/* Header / Date Selector */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm shadow-slate-200/50">
                <div className="space-y-1">
                    <h2 className="text-2xl font-bold text-slate-900 capitalize italic">{displayDate}</h2>
                    <p className="text-slate-500 text-sm">Gestiona el cronograma de hoy</p>
                </div>

                <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
                    <div className="relative group flex-1 md:flex-none">
                        <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                        <input
                            type="date"
                            className="bg-slate-50 border border-slate-200 rounded-xl py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all w-full md:w-48"
                            value={fecha}
                            onChange={e => setFecha(e.target.value)}
                        />
                    </div>
                    <div className="h-8 w-[1px] bg-slate-200 hidden md:block"></div>
                    <div className="flex items-center gap-2 flex-1 md:flex-none">
                        <input type="date" className="bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs outline-none" value={duplicateDate} onChange={e => setDuplicateDate(e.target.value)} />
                        <button onClick={handleDuplicate} className="p-2 text-slate-500 hover:text-primary hover:bg-primary/5 rounded-xl border border-slate-200 transition-colors"><Files className="w-5 h-5" /></button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Main Editor */}
                <div className="lg:col-span-8 space-y-6">
                    <div className="flex justify-between items-center px-2">
                        <h3 className="font-semibold text-slate-700 flex items-center gap-2"><Clock className="w-4 h-4 text-primary" /> Bloques de Trabajo</h3>
                        <div className="flex gap-2">
                            <button onClick={() => addBlock('note')} className="flex items-center gap-2 bg-slate-100 text-slate-600 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-slate-200 transition-all">
                                <StickyNote className="w-4 h-4" /> + Nota
                            </button>
                            <button onClick={() => addBlock('work')} className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary/90 shadow-lg shadow-primary/20 active:scale-95 transition-all">
                                <Plus className="w-4 h-4" /> Nuevo Bloque
                            </button>
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 animate-pulse"><div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4"></div><p className="text-slate-400 font-medium">Cargando...</p></div>
                    ) : (
                        <div className="space-y-4">
                            {blocks.map((block, index) => (
                                <div key={`block-${index}`} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative group hover:border-primary/30 transition-all duration-300">
                                    {/* Top Controls: Reorder (Left) and Actions (Right) */}
                                    <div className="flex justify-between items-center mb-6">
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => moveBlock(index, 'up')}
                                                disabled={index === 0}
                                                className="p-1.5 text-slate-300 hover:text-primary hover:bg-primary/5 rounded-lg disabled:opacity-0 transition-all border border-transparent hover:border-primary/20"
                                                title="Mover arriba"
                                            >
                                                <ChevronUp className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={() => moveBlock(index, 'down')}
                                                disabled={index === blocks.length - 1}
                                                className="p-1.5 text-slate-300 hover:text-primary hover:bg-primary/5 rounded-lg disabled:opacity-0 transition-all border border-transparent hover:border-primary/20"
                                                title="Mover abajo"
                                            >
                                                <ChevronDown className="w-5 h-5" />
                                            </button>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => saveAsFavorite(block)}
                                                className="p-2 text-slate-300 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-all"
                                                title="Guardar como favorito"
                                            >
                                                <Star className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={() => removeBlock(index)}
                                                className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                title="Eliminar bloque"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-5">
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">Tipo / Proyecto</label>
                                                {block.isNoteOnly ? (
                                                    <div className="w-full bg-slate-100 border border-slate-200 rounded-xl py-3 px-4 text-slate-500 font-bold italic flex items-center gap-2">
                                                        <StickyNote className="w-4 h-4" /> NOTA LIBRE
                                                    </div>
                                                ) : (
                                                    <select className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 appearance-auto" value={block.projectId || ''} onChange={e => updateBlock(index, 'projectId', e.target.value)}>
                                                        <option value="">Seleccionar Proyecto</option>
                                                        {projects.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                                                    </select>
                                                )}
                                            </div>

                                            {!block.isNoteOnly && (
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">Inicio</label>
                                                        <input type="time" className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-slate-700 outline-none" value={block.startTime || ''} onChange={e => updateBlock(index, 'startTime', e.target.value)} />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">Fin</label>
                                                        <input type="time" className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-slate-700 outline-none" value={block.endTime || ''} onChange={e => updateBlock(index, 'endTime', e.target.value)} />
                                                    </div>
                                                </div>
                                            )}

                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">{block.isNoteOnly ? 'Contenido de la Nota' : 'Nota / Detalles'}</label>
                                                <textarea
                                                    placeholder={block.isNoteOnly ? "Escribe tu mensaje aquí..." : "Añade detalles relevantes..."}
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 resize-none h-24"
                                                    value={block.note || ''} onChange={e => updateBlock(index, 'note', e.target.value)}
                                                />
                                            </div>
                                        </div>

                                        {!block.isNoteOnly && (
                                            <div className="space-y-3">
                                                <div className="flex justify-between items-center px-1">
                                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Operadores</label>
                                                    <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{block.operatorIds.length} seleccionados</span>
                                                </div>
                                                <div className="bg-slate-50/50 border border-slate-200 rounded-2xl p-4 h-[250px] overflow-y-auto space-y-1 custom-scrollbar">
                                                    {operators.map(op => {
                                                        const isSelected = block.operatorIds.includes(op.id);
                                                        const isFirstBlock = index === 0;

                                                        // Check if this operator is already used in ANY other block of the day
                                                        const isUsedElsewhere = blocks.some((otherBlock, otherIndex) =>
                                                            index !== otherIndex && otherBlock.operatorIds.includes(op.id)
                                                        );

                                                        let conflictBlock = -1;
                                                        const hasConflict = isUsedElsewhere && blocks.some((b, i) => {
                                                            if (i === index || !b.operatorIds.includes(op.id)) return false;

                                                            // If the other block has no end time, the operator is busy indefinitely
                                                            if (!b.endTime) {
                                                                conflictBlock = i + 1;
                                                                return true;
                                                            }

                                                            // Conflict: current start < other end
                                                            if (block.startTime && block.startTime < b.endTime) {
                                                                conflictBlock = i + 1;
                                                                return true;
                                                            }
                                                            return false;
                                                        });

                                                        // Rule: 
                                                        // 1. First block is always free.
                                                        // 2. Operators NOT used elsewhere are always free.
                                                        // 3. Operators used elsewhere are blocked if:
                                                        //    - No start time is set yet
                                                        //    - OR there is a conflict (other block has no end time OR start < other end)
                                                        const isDisabled = !isFirstBlock && isUsedElsewhere && !isSelected && (!block.startTime || hasConflict);
                                                        return (
                                                            <label key={op.id} className={`flex items-center gap-3 p-3 rounded-xl transition-all ${isSelected ? 'bg-primary/20 text-primary-dark font-medium border border-primary/20' : isDisabled ? 'opacity-40 cursor-not-allowed bg-slate-50 text-slate-400' : 'hover:bg-slate-100 text-slate-600 border border-transparent cursor-pointer'}`}>
                                                                <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-primary disabled:cursor-not-allowed" checked={isSelected} disabled={isDisabled} onChange={e => {
                                                                    const next = e.target.checked ? [...block.operatorIds, op.id] : block.operatorIds.filter((id: string) => id !== op.id);
                                                                    updateBlock(index, 'operatorIds', next);
                                                                }} />
                                                                <div className="flex flex-col"><span className="text-sm">{op.nombreCompleto}</span>{isDisabled && !isSelected && <span className="text-[9px] font-bold uppercase text-red-400">{hasConflict ? 'Ocupado' : 'Re-Asignar'}</span>}</div>
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Sidebar */}
                <div className="lg:col-span-4 sticky top-24 space-y-6">
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
                                    <button onClick={(e) => deleteFavorite(fav.id, e)} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"><X className="w-4 h-4" /></button>
                                </div>
                            ))}
                            {favorites.length === 0 && <p className="text-[11px] text-slate-400 italic text-center py-4">No tienes plantillas guardadas</p>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
