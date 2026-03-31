'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, ChevronDown, X } from 'lucide-react';

interface Option {
    id: string;
    label: string;
    group?: string;
}

interface SearchableSelectProps {
    options: Option[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    label?: string;
    icon?: React.ReactNode;
    disabled?: boolean;
    className?: string;
}

export default function SearchableSelect({
    options,
    value,
    onChange,
    placeholder = 'Seleccionar...',
    label,
    icon,
    disabled = false,
    className = ''
}: SearchableSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [highlightedIndex, setHighlightedIndex] = useState(0);

    const containerRef = useRef<HTMLDivElement>(null);
    // Tracks whether the upcoming focus event was caused by a mouse click
    const mouseDownRef = useRef(false);
    const inputRef = useRef<HTMLInputElement>(null);
    // Map from option index → DOM element for reliable scroll-into-view
    const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

    const selectedOption = options.find(opt => opt.id === value);

    const filteredOptions = options.filter(opt =>
        opt.label.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // ── Close on outside click ────────────────────────────────────────────────
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // ── On open: reset state + focus search input ─────────────────────────────
    useEffect(() => {
        if (isOpen) {
            setSearchTerm('');
            // Start highlighting the currently selected option, or first
            const selectedIdx = filteredOptions.findIndex(o => o.id === value);
            setHighlightedIndex(selectedIdx >= 0 ? selectedIdx : 0);
            // Focus search input — requestAnimationFrame is more reliable than setTimeout on mobile
            requestAnimationFrame(() => {
                inputRef.current?.focus();
            });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    // ── When search changes → highlight first filtered result ─────────────────
    useEffect(() => {
        setHighlightedIndex(0);
    }, [searchTerm]);

    // ── Scroll highlighted item into view ─────────────────────────────────────
    useEffect(() => {
        if (isOpen) {
            itemRefs.current[highlightedIndex]?.scrollIntoView({
                block: 'nearest',
                behavior: 'smooth',
            });
        }
    }, [highlightedIndex, isOpen]);

    // ── Reset itemRefs array size when filtered options change ────────────────
    useEffect(() => {
        itemRefs.current = itemRefs.current.slice(0, filteredOptions.length);
    }, [filteredOptions.length]);

    const handleSelect = useCallback((id: string) => {
        onChange(id);
        setIsOpen(false);
        setSearchTerm('');
    }, [onChange]);

    // ── Keyboard handler (used on container AND on search input) ──────────────
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!isOpen) {
            if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === ' ') {
                e.preventDefault();
                setIsOpen(true);
            }
            return;
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setHighlightedIndex(prev =>
                    filteredOptions.length > 0 ? (prev + 1) % filteredOptions.length : 0
                );
                break;

            case 'ArrowUp':
                e.preventDefault();
                setHighlightedIndex(prev =>
                    filteredOptions.length > 0
                        ? (prev - 1 + filteredOptions.length) % filteredOptions.length
                        : 0
                );
                break;

            case 'Enter':
            case 'Tab':
                // Both Enter and Tab confirm the highlighted option
                if (filteredOptions[highlightedIndex]) {
                    e.preventDefault();
                    handleSelect(filteredOptions[highlightedIndex].id);
                } else {
                    // Nothing highlighted → just close
                    setIsOpen(false);
                }
                break;

            case 'Escape':
                e.preventDefault();
                setIsOpen(false);
                break;
        }
    };

    return (
        <div
            className={`space-y-1.5 relative ${className}`}
            ref={containerRef}
            onKeyDown={handleKeyDown}
        >
            {label && (
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1">
                    {icon} {label}
                </label>
            )}

            {/* ── Trigger ── */}
            <div
                onMouseDown={() => { mouseDownRef.current = true; }}
                onClick={() => !disabled && setIsOpen(!isOpen)}
                onFocus={() => {
                    // If focus came from Tab (not mouse), open the dropdown immediately
                    if (!mouseDownRef.current && !disabled) {
                        setIsOpen(true);
                    }
                    mouseDownRef.current = false;
                }}
                className={`w-full min-h-[44px] md:h-[50px] bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl md:rounded-2xl py-2 md:py-3 px-3 md:px-4 flex items-center justify-between cursor-pointer transition-all text-sm ${
                    isOpen ? 'ring-4 ring-primary/10 border-primary' : 'hover:border-slate-300 dark:hover:border-slate-600'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                tabIndex={disabled ? -1 : 0}
            >
                <span className={`font-bold truncate ${selectedOption ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500'}`}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                    {selectedOption && !disabled && (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onChange(''); setIsOpen(false); }}
                            className="btn-icon-inline p-1 hover:bg-slate-200 rounded-md transition-colors"
                        >
                            <X className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 hover:text-slate-600" />
                        </button>
                    )}
                    <ChevronDown className={`w-4 h-4 text-slate-400 dark:text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </div>
            </div>

            {/* ── Dropdown panel ── */}
            {isOpen && (
                <div className="absolute z-[110] left-0 right-0 mt-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl md:rounded-[2rem] shadow-2xl animate-in zoom-in-95 duration-150 overflow-hidden min-w-full">

                    {/* Search bar */}
                    <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                        <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
                        <input
                            ref={inputRef}
                            type="text"
                            inputMode="search"
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="off"
                            spellCheck={false}
                            placeholder="Buscar..."
                            className="w-full outline-none text-sm font-medium py-1 bg-transparent text-slate-700 dark:text-slate-200"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={handleKeyDown}
                        />
                        {searchTerm && (
                            <button
                                className="btn-icon-inline p-1"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSearchTerm('');
                                    setHighlightedIndex(0);
                                    inputRef.current?.focus();
                                }}
                            >
                                <X className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                            </button>
                        )}
                    </div>

                    {/* Options list */}
                    <div className="max-h-60 overflow-y-auto p-2">
                        {filteredOptions.length === 0 ? (
                            <div className="p-4 text-center text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">
                                No se encontraron resultados
                            </div>
                        ) : (
                            filteredOptions.map((opt, index) => {
                                const showGroupHeader = opt.group && (index === 0 || opt.group !== filteredOptions[index - 1].group);
                                const isHighlighted = highlightedIndex === index;
                                const isSelected = value === opt.id;

                                return (
                                    <div key={`container-${opt.id}`}>
                                        {showGroupHeader && (
                                            <div className="px-3 pt-3 pb-1 text-[10px] font-black text-primary/70 uppercase tracking-widest border-b border-primary/10 mb-1">
                                                {opt.group}
                                            </div>
                                        )}
                                        <div
                                            ref={el => { itemRefs.current[index] = el; }}
                                            onMouseEnter={() => setHighlightedIndex(index)}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleSelect(opt.id);
                                            }}
                                            className={`p-3 rounded-xl text-sm font-bold cursor-pointer transition-colors min-h-[44px] flex items-center ${
                                                isSelected
                                                    ? 'bg-primary/20 text-primary'
                                                    : isHighlighted
                                                        ? 'bg-slate-100 dark:bg-slate-800/50 text-slate-900 dark:text-slate-50'
                                                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80'
                                            }`}
                                        >
                                            <span className="break-words">{opt.label}</span>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
