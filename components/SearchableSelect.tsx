'use client';

import { useState, useRef, useEffect } from 'react';
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
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find(opt => opt.id === value);

    const filteredOptions = options.filter(opt =>
        opt.label.toLowerCase().includes(searchTerm.toLowerCase())
    );

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (isOpen) {
            setSearchTerm('');
            setHighlightedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    useEffect(() => {
        setHighlightedIndex(0);
    }, [searchTerm]);

    useEffect(() => {
        if (isOpen && listRef.current) {
            const highlightedElement = listRef.current.children[highlightedIndex] as HTMLElement;
            if (highlightedElement) {
                const container = listRef.current;
                const elementTop = highlightedElement.offsetTop;
                const elementBottom = elementTop + highlightedElement.offsetHeight;
                const containerTop = container.scrollTop;
                const containerBottom = containerTop + container.offsetHeight;

                if (elementTop < containerTop) {
                    container.scrollTop = elementTop;
                } else if (elementBottom > containerBottom) {
                    container.scrollTop = elementBottom - container.offsetHeight;
                }
            }
        }
    }, [highlightedIndex, isOpen]);

    const handleSelect = (id: string) => {
        onChange(id);
        setIsOpen(false);
        setSearchTerm('');
    };

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
                setHighlightedIndex(prev => (prev + 1) % filteredOptions.length);
                break;
            case 'ArrowUp':
                e.preventDefault();
                setHighlightedIndex(prev => (prev - 1 + filteredOptions.length) % filteredOptions.length);
                break;
            case 'Enter':
                e.preventDefault();
                if (filteredOptions[highlightedIndex]) {
                    handleSelect(filteredOptions[highlightedIndex].id);
                }
                break;
            case 'Escape':
                e.preventDefault();
                setIsOpen(false);
                break;
            case 'Tab':
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
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">
                    {icon} {label}
                </label>
            )}

            <div
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className={`w-full min-h-[44px] md:h-[50px] bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl py-2 md:py-3 px-3 md:px-4 flex items-center justify-between cursor-pointer transition-all text-sm ${isOpen ? 'ring-4 ring-primary/10 border-primary' : 'hover:border-slate-300'
                    } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                tabIndex={disabled ? -1 : 0}
            >
                <span className={`font-bold truncate ${selectedOption ? 'text-slate-700' : 'text-slate-400'}`}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                    {selectedOption && !disabled && (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onChange(''); setIsOpen(false); }}
                            className="btn-icon-inline p-1 hover:bg-slate-200 rounded-md transition-colors"
                        >
                            <X className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600" />
                        </button>
                    )}
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </div>
            </div>

            {isOpen && (
                <div className="absolute z-[110] w-full mt-1.5 bg-white border border-slate-200 rounded-2xl md:rounded-[2rem] shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
                    <div className="p-3 border-b border-slate-100 flex items-center gap-2">
                        <Search className="w-4 h-4 text-slate-400 shrink-0" />
                        <input
                            ref={inputRef}
                            type="text"
                            inputMode="search"
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="off"
                            spellCheck={false}
                            placeholder="Buscar..."
                            className="w-full outline-none text-sm font-medium py-1"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={handleKeyDown}
                        />
                        {searchTerm && (
                            <button className="btn-icon-inline p-1" onClick={(e) => { e.stopPropagation(); setSearchTerm(''); setHighlightedIndex(0); }}>
                                <X className="w-3 h-3 text-slate-400" />
                            </button>
                        )}
                    </div>
                    <div className="max-h-60 overflow-y-auto p-2" ref={listRef}>
                        {filteredOptions.length === 0 ? (
                            <div className="p-4 text-center text-xs text-slate-400 font-bold uppercase tracking-widest">
                                No se encontraron resultados
                            </div>
                        ) : (
                            filteredOptions.map((opt, index) => {
                                const showGroupHeader = opt.group && (index === 0 || opt.group !== filteredOptions[index - 1].group);
                                return (
                                    <div key={`container-${opt.id}`}>
                                        {showGroupHeader && (
                                            <div className="px-3 pt-3 pb-1 text-[10px] font-black text-primary/70 uppercase tracking-widest border-b border-primary/10 mb-1">
                                                {opt.group}
                                            </div>
                                        )}
                                        <div
                                            key={opt.id}
                                            onMouseMove={() => setHighlightedIndex(index)}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleSelect(opt.id);
                                            }}
                                            className={`p-3 md:p-3 rounded-xl text-sm font-bold cursor-pointer transition-colors min-h-[44px] flex items-center ${value === opt.id
                                                ? 'bg-primary/20 text-primary'
                                                : highlightedIndex === index
                                                    ? 'bg-slate-100 text-slate-900'
                                                    : 'text-slate-600 hover:bg-slate-50'
                                                }`}
                                        >
                                            {opt.label}
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
