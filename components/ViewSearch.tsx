'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, ArrowUp, ArrowDown, CornerDownLeft } from 'lucide-react';
import { ViewConfig, DEFAULT_SECTIONS } from '@/lib/viewAccess';
import { renderIcon } from '@/lib/iconRegistry';

interface ViewSearchProps {
    views: ViewConfig[];
    role: string;
}

export default function ViewSearch({ views, role }: ViewSearchProps) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [selectedIdx, setSelectedIdx] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    // Filter views by role and search query
    const filtered = views.filter(v => {
        if (!v.roles.includes(role)) return false;
        if (!query.trim()) return true;
        const normalize = (s: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        const q = normalize(query);
        return (
            normalize(v.label).includes(q) ||
            normalize(v.description).includes(q) ||
            normalize(v.key).includes(q) ||
            normalize(DEFAULT_SECTIONS.find(s => s.key === v.section)?.label || '').includes(q)
        );
    });

    // Group by section
    const grouped = DEFAULT_SECTIONS
        .map(s => ({ section: s, items: filtered.filter(v => v.section === s.key) }))
        .filter(g => g.items.length > 0);

    // Flat list for keyboard navigation
    const flatItems = grouped.flatMap(g => g.items);

    // Ctrl+K / Cmd+K shortcut
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
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

    // Keyboard navigation within the input
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIdx(prev => Math.min(prev + 1, flatItems.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIdx(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter' && flatItems[selectedIdx]) {
            e.preventDefault();
            navigateTo(flatItems[selectedIdx].key);
        }
    }, [flatItems, selectedIdx]);

    // Scroll selected into view
    useEffect(() => {
        const el = listRef.current?.querySelector(`[data-idx="${selectedIdx}"]`);
        el?.scrollIntoView({ block: 'nearest' });
    }, [selectedIdx]);

    // Reset selection when query changes
    useEffect(() => { setSelectedIdx(0); }, [query]);

    const navigateTo = (href: string) => {
        setOpen(false);
        router.push(href);
    };

    if (!open) return null;

    let flatIdx = 0;

    return (
        <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[12vh] sm:pt-[15vh]">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={() => setOpen(false)}
            />

            {/* Panel */}
            <div className="relative w-full max-w-lg mx-4 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 slide-in-from-top-4 duration-300">
                {/* Search input */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-700">
                    <Search className="w-5 h-5 text-slate-400 shrink-0" />
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Buscar vistas, módulos..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="flex-1 bg-transparent outline-none text-base text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    />
                    <button
                        onClick={() => setOpen(false)}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                        <X className="w-4 h-4 text-slate-400" />
                    </button>
                </div>

                {/* Results */}
                <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-2">
                    {grouped.length === 0 ? (
                        <div className="py-12 text-center">
                            <Search className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                            <p className="text-sm text-slate-400 dark:text-slate-500 font-semibold">No se encontraron vistas</p>
                        </div>
                    ) : (
                        grouped.map(g => (
                            <div key={g.section.key} className="mb-1">
                                <p className="px-3 py-1.5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                    {g.section.label}
                                </p>
                                {g.items.map(item => {
                                    const idx = flatIdx++;
                                    const isSelected = idx === selectedIdx;
                                    return (
                                        <button
                                            key={item.key}
                                            data-idx={idx}
                                            onClick={() => navigateTo(item.key)}
                                            onMouseEnter={() => setSelectedIdx(idx)}
                                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150 ${
                                                isSelected
                                                    ? 'bg-primary/10 dark:bg-primary/20'
                                                    : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                                            }`}
                                        >
                                            <div className={`${item.color} text-white p-2 rounded-lg shrink-0`}>
                                                {renderIcon(item.iconName, 'w-4 h-4')}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm font-bold truncate ${isSelected ? 'text-primary' : 'text-slate-700 dark:text-slate-200'}`}>
                                                    {item.label}
                                                </p>
                                                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium truncate">
                                                    {item.description}
                                                </p>
                                            </div>
                                            {isSelected && (
                                                <CornerDownLeft className="w-3.5 h-3.5 text-primary shrink-0" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        ))
                    )}
                </div>

                {/* Footer hints */}
                <div className="flex items-center justify-center gap-4 px-4 py-2.5 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30">
                    <span className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500 font-semibold">
                        <span className="flex items-center gap-0.5">
                            <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded text-[9px] font-bold shadow-sm"><ArrowUp className="w-2.5 h-2.5 inline" /></kbd>
                            <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded text-[9px] font-bold shadow-sm"><ArrowDown className="w-2.5 h-2.5 inline" /></kbd>
                        </span>
                        navegar
                    </span>
                    <span className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500 font-semibold">
                        <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded text-[9px] font-bold shadow-sm">↵</kbd>
                        abrir
                    </span>
                    <span className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500 font-semibold">
                        <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded text-[9px] font-bold shadow-sm">esc</kbd>
                        cerrar
                    </span>
                </div>
            </div>
        </div>
    );
}
