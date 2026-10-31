'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, ArrowUp, ArrowDown, CornerDownLeft, Clock, LayoutGrid } from 'lucide-react';
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

    const commandsMap = useCommandStore((state) => state.commands);
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
        const commands = Object.values(commandsMap)
            .sort((a, b) => (b.priority || 0) - (a.priority || 0))
            .filter(c => {
                if (!q) return true;
                const haystack = [
                    c.label,
                    c.category,
                    c.description || '',
                    ...(c.keywords || []),
                ].map(normalize).join(' ');
                return haystack.includes(q);
            });
        if (commands.length > 0) {
            items.push({ type: 'header', label: 'Acciones' });
            commands.forEach(cmd => {
                items.push({
                    type: 'command',
                    id: cmd.id,
                    label: cmd.label,
                    description: cmd.description || cmd.category,
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
    }, [query, views, role, commandsMap, historyEntries, router]);

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
                className="scrim animate-in fade-in duration-150"
                onClick={() => setOpen(false)}
            />

            <div role="dialog" aria-modal="true" aria-label="Buscador global" className="relative w-full max-w-2xl mx-4 bg-popover text-popover-foreground rounded-2xl shadow-2xl border border-border overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center gap-3 px-4 h-14 border-b border-border">
                    <Search className="w-5 h-5 text-slate-400 shrink-0" />
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Buscar vistas, acciones, registros recientes..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        aria-label="Buscar vistas, acciones y registros recientes"
                        className="flex-1 !bg-transparent !border-0 !p-0 !min-h-0 outline-none focus-visible:!outline-none text-base text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
                    />
                    <button
                        onClick={() => setOpen(false)}
                        className="btn btn-ghost btn-icon btn-sm btn-icon-inline"
                        aria-label="Cerrar buscador"
                    >
                        <X />
                    </button>
                </div>

                <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-2">
                    {flatItems.length === 0 ? (
                        <div className="py-12 text-center">
                            <Search className="w-6 h-6 text-slate-400 mx-auto mb-2" aria-hidden="true" />
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">No se encontraron resultados</p>
                            <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-1">Probá con el nombre de un módulo o una acción.</p>
                        </div>
                    ) : (
                        flatItems.map((item, i) => {
                            if (item.type === 'header') {
                                return (
                                    <p key={`header-${i}`} className="eyebrow px-3 pt-3 pb-1.5 first:pt-1">
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
                                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                                        isSelected
                                            ? 'bg-brand-50 dark:bg-brand-950'
                                            : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                                    }`}
                                >
                                    <div className={`w-8 h-8 flex items-center justify-center rounded-lg shrink-0 ${
                                        isSelected
                                            ? 'bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-200'
                                            : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                                    }`}>
                                        {item.type === 'view' ? renderIcon(item.iconName, 'w-4 h-4') :
                                         item.type === 'command' ? renderIcon(item.iconName, 'w-4 h-4') :
                                         <Clock className="w-4 h-4" />}
                                    </div>
                                    
                                    <div className="flex-1 min-w-0 flex items-center justify-between">
                                        <div>
                                            <p className={`text-[13px] font-medium truncate ${isSelected ? 'text-brand-800 dark:text-brand-100' : 'text-slate-800 dark:text-slate-100'}`}>
                                                {item.label}
                                            </p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                                {item.description}
                                            </p>
                                        </div>
                                        {item.keys && (
                                            <div className="hidden sm:flex gap-1 items-center">
                                                {item.keys.map((k: string) => (
                                                    <kbd key={k} className="kbd">
                                                        {k === 'ctrl' ? 'Ctrl' : k.toUpperCase()}
                                                    </kbd>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    
                                    {isSelected && <CornerDownLeft className="w-4 h-4 text-brand-600 dark:text-brand-300 shrink-0" aria-hidden="true" />}
                                </button>
                            );
                        })
                    )}
                </div>

                <div className="hidden sm:flex items-center gap-4 px-4 h-10 border-t border-border bg-surface-sunken text-xs text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1.5">
                        <span className="flex items-center gap-0.5">
                            <kbd className="kbd"><ArrowUp className="w-2.5 h-2.5 inline" /></kbd>
                            <kbd className="kbd"><ArrowDown className="w-2.5 h-2.5 inline" /></kbd>
                        </span>
                        navegar
                    </span>
                    <span className="flex items-center gap-1.5">
                        <kbd className="kbd">↵</kbd>
                        ejecutar
                    </span>
                    <span className="flex items-center gap-1.5">
                        <kbd className="kbd">esc</kbd>
                        cerrar
                    </span>
                </div>
            </div>
        </div>
    );
}
