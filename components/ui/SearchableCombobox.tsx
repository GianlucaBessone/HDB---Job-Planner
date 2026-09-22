'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, Plus, X } from 'lucide-react';

export interface ComboboxOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface SearchableComboboxProps {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  allowCreate?: boolean;
  createLabel?: string;
  onCreate?: (newValue: string) => void;
  className?: string;
  isClearable?: boolean;
}

export default function SearchableCombobox({
  options,
  value,
  onChange,
  placeholder = 'Seleccionar opción...',
  searchPlaceholder = 'Buscar...',
  emptyText = 'No se encontraron resultados',
  disabled = false,
  allowCreate = false,
  createLabel = 'Crear nuevo',
  onCreate,
  className = '',
  isClearable = true,
}: SearchableComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      setSearch('');
    }
  }, [isOpen]);

  const selectedOption = options.find((opt) => opt.value === value);

  // Filter options based on search query
  const filteredOptions = options.filter(
    (opt) =>
      (opt?.label || '').toLowerCase().includes(search.toLowerCase()) ||
      (opt?.sublabel && opt.sublabel.toLowerCase().includes(search.toLowerCase()))
  );

  const isExactMatch = options.some(
    (opt) => (opt?.label || '').trim().toLowerCase() === search.trim().toLowerCase()
  );

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  const handleCreate = () => {
    if (!search.trim()) return;
    const trimmed = search.trim();
    if (onCreate) {
      onCreate(trimmed);
    } else {
      onChange(trimmed);
    }
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full px-3.5 py-2.5 rounded-xl border text-left flex items-center justify-between text-xs transition-all ${
          disabled
            ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-800 cursor-not-allowed'
            : isOpen
            ? 'border-primary ring-2 ring-primary/10 bg-white dark:bg-slate-900 shadow-sm'
            : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-800 dark:text-slate-200'
        }`}
      >
        <span className="truncate">
          {selectedOption ? (
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {selectedOption.label}
              {selectedOption.sublabel && (
                <span className="text-[10px] text-slate-400 font-normal ml-1.5">
                  ({selectedOption.sublabel})
                </span>
              )}
            </span>
          ) : value ? (
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {value}
            </span>
          ) : (
            <span className="text-slate-400 dark:text-slate-500 font-normal">
              {placeholder}
            </span>
          )}
        </span>

        <div className="flex items-center gap-1 shrink-0 ml-2">
          {isClearable && (selectedOption || value) && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-3 h-3" />
            </span>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
              isOpen ? 'rotate-180 text-primary' : ''
            }`}
          />
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 mt-1.5 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Search Box */}
          <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-10 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Options List */}
          <div className="max-h-56 overflow-y-auto p-1 space-y-0.5">
            {allowCreate && search.trim() && !isExactMatch && (
              <button
                type="button"
                onClick={handleCreate}
                className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold text-primary hover:bg-primary/5 flex items-center gap-2 transition-colors border-b border-dashed border-slate-100 dark:border-slate-800 mb-1"
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">
                  {createLabel}: &quot;{search.trim()}&quot;
                </span>
              </button>
            )}

            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelect(opt.value)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between transition-colors ${
                      isSelected
                        ? 'bg-primary/10 text-primary font-bold'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 font-medium'
                    }`}
                  >
                    <div className="truncate">
                      <div>{opt.label}</div>
                      {opt.sublabel && (
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">
                          {opt.sublabel}
                        </div>
                      )}
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0 ml-2" />}
                  </button>
                );
              })
            ) : !allowCreate || !search.trim() ? (
              <div className="px-3 py-6 text-center text-xs text-slate-400 dark:text-slate-500">
                {emptyText}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
