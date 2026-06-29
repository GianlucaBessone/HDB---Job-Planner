'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, ArrowUp, ArrowDown, CornerDownLeft, TerminalSquare, Clock, LayoutGrid } from 'lucide-react';
import { ViewConfig, DEFAULT_SECTIONS } from '@/lib/viewAccess';
import { renderIcon } from '@/lib/iconRegistry';
import { useCommandStore } from '@/lib/store/useCommandStore';
import { useHistoryStore } from '@/lib/store/useHistoryStore';

interface CommandPaletteProps {
    views: ViewConfig[];
    role: string;
}

export function CommandPalette({ views, role }: CommandPaletteProps) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [selectedIdx, setSelectedIdx] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    const getCommandsArray = useCommandStore((state) => state.getCommandsArray);
    const historyEntries = useHistoryStore((state) => state.entries);

    // Ctrl+K / Cmd+K shortcut
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setOpen(prev => !prev);
            }
            if (e.key === 'Escape' && open) {
                setOpen(false);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [open]);

    // Focus input when opened
    useEffect(() => {
        if (open) {
            setQuery('');
            setSelectedIdx(0);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [open]);

    const normalize = (s: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

    // Data filtering
    const flatItems = useMemo(() => {
        const q = normalize(query);
        const items: any[] = [];

        // 1. Acciones (Commands)
        const commands = getCommandsArray().filter(c => !q || normalize(c.label).includes(q) || normalize(c.category).includes(q));
        if (commands.length > 0) {
            items.push({ type: 'header', label: 'Acciones' });
            commands.forEach(cmd => {
                items.push({
                    type: 'command',
                    id: cmd.id,
                    label: cmd.label,
                    description: cmd.category,
                    iconName: cmd.icon || 'TerminalSquare',
                    keys: cmd.keys,
                    action: cmd.action,
                });
            });
        }

        // 2. Vistas
        const filteredViews = views.filter(v => {
            if (!v.roles.includes(role)) return false;
            if (!q) return true;
            return (
                normalize(v.label).includes(q) ||
                normalize(v.description).includes(q) ||
                normalize(v.key).includes(q)
            );
        });
        
        if (filteredViews.length > 0) {
            // Group views internally by section for better UX if needed, but here we just list them
            items.push({ type: 'header', label: 'Vistas' });
            filteredViews.forEach(v => {
                items.push({
                    type: 'view',
                    id: v.key,
                    label: v.label,
                    description: v.description,
                    iconName: v.iconName,
                    color: v.color,
                    action: () => router.push(v.key),
                });
            });
        }

        // 3. Historial (Only if query is empty)
        if (!q && historyEntries.length > 0) {
            items.push({ type: 'header', label: 'Recientes' });
            // Get last 5 unique paths
            const recent = [...historyEntries].reverse().slice(0, 5);
            recent.forEach((entry, idx) => {
                items.push({
                    type: 'history',
                    id: `hist-${idx}-${entry.url}`,
                    label: entry.title,
                    description: entry.url,
                    iconName: 'Clock',
                    action: () => router.push(entry.url),
                });
            });
        }

        return items;
    }, [query, views, role, getCommandsArray, historyEntries, router]);

    // Filter out headers for navigation indexing
    const navigableItems = flatItems.filter(item => item.type !== 'header');

    // Keyboard navigation within the input
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIdx(prev => Math.min(prev + 1, navigableItems.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIdx(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter' && navigableItems[selectedIdx]) {
            e.preventDefault();
            const item = navigableItems[selectedIdx];
            setOpen(false);
            item.action();
        }
    }, [navigableItems, selectedIdx]);

    // Scroll selected into view
    useEffect(() => {
        const el = listRef.current?.querySelector(`[data-idx="${selectedIdx}"]`);
        el?.scrollIntoView({ block: 'nearest' });
    }, [selectedIdx]);

    // Reset selection when query changes
    useEffect(() => { setSelectedIdx(0); }, [query]);

    if (!open) return null;

    let navIdx = 0;

    return (
        <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[12vh] sm:pt-[15vh]">
            <div
                className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={() => setOpen(false)}
            />

            <div className="relative w-full max-w-2xl mx-4 bg-card text-card-foreground rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 slide-in-from-top-4 duration-300">
                <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-700">
                    <Search className="w-5 h-5 text-slate-400 shrink-0" />
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Buscar vistas, acciones, registros recientes..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="flex-1 bg-transparent outline-none text-base sm:text-lg font-medium text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                    />
                    <button
                        onClick={() => setOpen(false)}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-2">
                    {flatItems.length === 0 ? (
                        <div className="py-12 text-center">
                            <Search className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                            <p className="text-sm text-slate-400 font-semibold">No se encontraron resultados</p>
                        </div>
                    ) : (
                        flatItems.map((item, i) => {
                            if (item.type === 'header') {
                                return (
                                    <p key={`header-${i}`} className="px-3 py-2 mt-2 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest first:mt-0">
                                        {item.label}
                                    </p>
                                );
                            }

                            const idx = navIdx++;
                            const isSelected = idx === selectedIdx;

                            return (
                                <button
                                    key={`item-${item.id}`}
                                    data-idx={idx}
                                    onClick={() => {
                                        setOpen(false);
                                        item.action();
                                    }}
                                    onMouseEnter={() => setSelectedIdx(idx)}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150 ${
                                        isSelected
                                            ? 'bg-primary/10 dark:bg-primary/20'
                                            : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                                    }`}
                                >
                                    <div className={`p-2 rounded-lg shrink-0 ${
                                        item.type === 'view' ? (item.color + ' text-white') : 
                                        item.type === 'command' ? 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300' :
                                        'bg-slate-100 dark:bg-slate-800 text-slate-500'
                                    }`}>
                                        {item.type === 'view' ? renderIcon(item.iconName, 'w-4 h-4') :
                                         item.type === 'command' ? <TerminalSquare className="w-4 h-4" /> :
                                         <Clock className="w-4 h-4" />}
                                    </div>
                                    
                                    <div className="flex-1 min-w-0 flex items-center justify-between">
                                        <div>
                                            <p className={`text-sm font-bold truncate ${isSelected ? 'text-primary' : 'text-slate-700 dark:text-slate-200'}`}>
                                                {item.label}
                                            </p>
                                            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium truncate">
                                                {item.description}
                                            </p>
                                        </div>
                                        {item.keys && (
                                            <div className="hidden sm:flex gap-1 items-center">
                                                {item.keys.map((k: string) => (
                                                    <kbd key={k} className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded text-[10px] font-bold text-slate-500 uppercase">
                                                        {k === 'ctrl' ? '⌘' : k}
                                                    </kbd>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    
                                    {isSelected && <CornerDownLeft className="w-4 h-4 text-primary shrink-0 opacity-50" />}
                                </button>
                            );
                        })
                    )}
                </div>

                <div className="flex flex-wrap items-center justify-center gap-4 px-4 py-3 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30">
                    <span className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold">
                        <span className="flex items-center gap-0.5">
                            <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded text-[9px] font-bold shadow-sm"><ArrowUp className="w-2.5 h-2.5 inline" /></kbd>
                            <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded text-[9px] font-bold shadow-sm"><ArrowDown className="w-2.5 h-2.5 inline" /></kbd>
                        </span>
                        navegar
                    </span>
                    <span className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold">
                        <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded text-[9px] font-bold shadow-sm">↵</kbd>
                        ejecutar
                    </span>
                    <span className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold">
                        <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded text-[9px] font-bold shadow-sm">esc</kbd>
                        cerrar
                    </span>
                </div>
            </div>
        </div>
    );
}
