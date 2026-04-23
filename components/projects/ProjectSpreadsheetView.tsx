'use client';

import { useState, useRef, useEffect } from 'react';
import { Project, ProjectStatus, ALL_STATUSES, STATUS_CONFIG, getProgressColor } from '@/lib/projectTypes';
import { safeApiRequest } from '@/lib/offline';
import { Loader2, Check } from 'lucide-react';
import { showToast } from '@/components/Toast';

export default function ProjectSpreadsheetView({
    projects,
    onRefresh
}: {
    projects: Project[];
    onRefresh: (silent?: boolean) => Promise<void>;
}) {
    const [savingId, setSavingId] = useState<string | null>(null);
    const [savedId, setSavedId] = useState<string | null>(null);

    const handleUpdate = async (project: Project, field: keyof Project, value: any) => {
        if (project[field] === value) return; // No change

        setSavingId(project.id);
        setSavedId(null);

        try {
            const res = await safeApiRequest(`/api/projects?id=${project.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ [field]: value }),
                headers: { 'Content-Type': 'application/json' }
            });
            if (res.ok) {
                setSavedId(project.id);
                setTimeout(() => setSavedId(null), 2000);
                await onRefresh(true);
            } else {
                showToast('Error al guardar cambio', 'error');
            }
        } catch (e) {
            console.error(e);
            showToast('Error de red al guardar', 'error');
        } finally {
            if (savingId === project.id) setSavingId(null);
        }
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse min-w-[1000px]">
                    <thead>
                        <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700">
                            <th className="px-4 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest sticky left-0 bg-slate-50 dark:bg-slate-900/90 backdrop-blur z-10 w-24">Código</th>
                            <th className="px-4 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest sticky left-24 bg-slate-50 dark:bg-slate-900/90 backdrop-blur z-10 shadow-[2px_0_5px_rgba(0,0,0,0.05)] w-48">Nombre</th>
                            <th className="px-4 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest w-40">Cliente</th>
                            <th className="px-4 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest w-40">Responsable</th>
                            <th className="px-4 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest w-32">Estado</th>
                            <th className="px-4 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right w-24">Horas Est.</th>
                            <th className="px-4 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right w-24">Horas Cons.</th>
                            <th className="px-4 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest min-w-[280px]">Fechas</th>
                            <th className="px-4 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest w-24">Avance</th>
                            <th className="px-4 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center w-12">📝</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                        {projects.map((p) => {
                            const isSaving = savingId === p.id;
                            const isSaved = savedId === p.id;
                            const progress = (p.horasEstimadas || 0) > 0 ? Math.min(100, Math.round((p.horasConsumidas / p.horasEstimadas) * 100)) : 0;
                            const progressColor = getProgressColor(progress);
                            
                            return (
                                <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/80 transition-colors group">
                                    <td className="px-4 py-2 border-r border-slate-50 dark:border-slate-800 sticky left-0 bg-white/95 dark:bg-slate-800/95 backdrop-blur z-10 w-24 align-middle">
                                        <span className="text-xs font-mono font-bold text-primary">{p.codigoProyecto || '-'}</span>
                                    </td>
                                    <td className="px-4 py-2 border-r border-slate-50 dark:border-slate-800 sticky left-24 bg-white/95 dark:bg-slate-800/95 backdrop-blur z-10 shadow-[2px_0_5px_rgba(0,0,0,0.02)] w-48 align-middle">
                                        <EditableText 
                                            value={p.nombre} 
                                            onSave={(val) => handleUpdate(p, 'nombre', val)} 
                                            className="font-bold text-slate-800 dark:text-slate-100 text-sm w-full cursor-text block truncate"
                                        />
                                    </td>
                                    <td className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 w-40 truncate align-middle">
                                        {p.client?.nombre || p.cliente || '—'}
                                    </td>
                                    <td className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 w-40 truncate align-middle">
                                        {p.responsableUser?.nombreCompleto || p.responsable || '—'}
                                    </td>
                                    <td className="px-4 py-2 align-middle">
                                        <select 
                                            value={p.estado} 
                                            onChange={(e) => handleUpdate(p, 'estado', e.target.value)}
                                            className={`text-[11px] font-bold rounded-lg px-2 py-1 outline-none border border-transparent cursor-pointer bg-slate-100 dark:bg-slate-800 transition-all shadow-sm ${STATUS_CONFIG[p.estado]?.color}`}
                                        >
                                            {ALL_STATUSES.map(s => (
                                                <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="px-4 py-2 text-right align-middle">
                                        <EditableNumber 
                                            value={p.horasEstimadas} 
                                            onSave={(val) => handleUpdate(p, 'horasEstimadas', val)} 
                                            className="font-mono text-xs font-bold text-slate-700 dark:text-slate-200 cursor-text w-full block text-right"
                                        />
                                    </td>
                                    <td className="px-4 py-2 text-right align-middle">
                                        <EditableNumber 
                                            value={p.horasConsumidas} 
                                            onSave={(val) => handleUpdate(p, 'horasConsumidas', val)} 
                                            className="font-mono text-xs font-bold text-slate-700 dark:text-slate-200 cursor-text w-full block text-right"
                                        />
                                    </td>
                                    <td className="px-4 py-2 align-middle">
                                        <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                                            <input 
                                                type="date" 
                                                value={p.fechaInicio || ''} 
                                                onChange={(e) => handleUpdate(p, 'fechaInicio', e.target.value)}
                                                className="bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-600 outline-none w-[110px] cursor-pointer focus:border-primary px-1"
                                            />
                                            <span className="text-slate-300 font-bold">→</span>
                                            <input 
                                                type="date" 
                                                value={p.fechaFin || ''} 
                                                onChange={(e) => handleUpdate(p, 'fechaFin', e.target.value)}
                                                className="bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-600 outline-none w-[110px] cursor-pointer focus:border-primary px-1"
                                            />
                                        </div>
                                    </td>
                                    <td className="px-4 py-2 align-middle">
                                        <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden mt-0.5" title={`${progress}% completado`}>
                                            <div className={`h-full rounded-full ${progressColor} transition-all duration-500`} style={{ width: `${progress}%` }} />
                                        </div>
                                    </td>
                                    <td className="px-4 py-2 text-center align-middle">
                                        <div className="w-5 h-5 inline-flex items-center justify-center relative">
                                            {isSaving && <Loader2 className="w-4 h-4 text-primary animate-spin absolute" />}
                                            {isSaved && <Check className="w-4 h-4 text-emerald-500 animate-in zoom-in duration-300 absolute" />}
                                            {!isSaving && !isSaved && <span className="w-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700" title="Sin cambios guardando" />}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function EditableText({ value, onSave, className }: { value: string, onSave: (v: string) => void, className?: string }) {
    const [isEditing, setIsEditing] = useState(false);
    const [val, setVal] = useState(value);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { setVal(value); }, [value]);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isEditing]);

    const handleBlur = () => {
        setIsEditing(false);
        if (val !== value) onSave(val);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleBlur();
        if (e.key === 'Escape') {
            setVal(value);
            setIsEditing(false);
        }
    };

    if (isEditing) {
        return (
            <input 
                ref={inputRef}
                type="text" 
                value={val} 
                onChange={e => setVal(e.target.value)} 
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                className={`bg-white dark:bg-slate-900 border border-primary/50 shadow-sm rounded px-1.5 py-0.5 outline-none focus:ring-2 focus:ring-primary/20 ${className}`}
            />
        );
    }

    return (
        <span 
            onClick={() => setIsEditing(true)} 
            className={`border border-transparent hover:border-slate-200 dark:hover:border-slate-600 rounded px-1.5 py-0.5 transition-colors ${className}`}
            title="Click para editar"
        >
            {value || '—'}
        </span>
    );
}

function EditableNumber({ value, onSave, className }: { value: number | string, onSave: (v: number) => void, className?: string }) {
    const [isEditing, setIsEditing] = useState(false);
    const [val, setVal] = useState(value.toString());
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { setVal(value.toString()); }, [value]);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const handleBlur = () => {
        setIsEditing(false);
        const parsed = parseFloat(val);
        if (!isNaN(parsed) && parsed >= 0 && parsed !== parseFloat(value.toString())) {
            onSave(parsed);
        } else {
            setVal(value.toString());
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleBlur();
        if (e.key === 'Escape') {
            setVal(value.toString());
            setIsEditing(false);
        }
    };

    if (isEditing) {
        return (
            <input 
                ref={inputRef}
                type="number" 
                min={0}
                step="any"
                value={val} 
                onChange={e => setVal(e.target.value)} 
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                className={`bg-white dark:bg-slate-900 border border-primary/50 shadow-sm rounded px-1.5 py-0.5 outline-none focus:ring-2 focus:ring-primary/20 text-right ${className}`}
            />
        );
    }

    return (
        <span 
            onClick={() => setIsEditing(true)} 
            className={`border border-transparent hover:border-slate-200 dark:hover:border-slate-600 rounded px-1.5 py-0.5 transition-colors ${className}`}
            title="Click para editar"
        >
            {value}h
        </span>
    );
}
