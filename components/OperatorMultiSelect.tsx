import { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';

interface OperatorMultiSelectProps {
    operators: any[];
    selectedIds: string[];
    onChange: (ids: string[]) => void;
    placeholder?: string;
}

export default function OperatorMultiSelect({ operators, selectedIds, onChange, placeholder = "Buscar participantes..." }: OperatorMultiSelectProps) {
    const [search, setSearch] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [focusedIndex, setFocusedIndex] = useState(-1);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const filteredOperators = operators.filter(op => 
        op.activo !== false && 
        !selectedIds.includes(op.id) &&
        normalize(op.nombreCompleto).includes(normalize(search))
    ).slice(0, 5);

    useEffect(() => {
        setFocusedIndex(-1);
    }, [search]);

    const handleSelect = (id: string) => {
        onChange([...selectedIds, id]);
        setSearch('');
        setIsOpen(false);
        setFocusedIndex(-1);
    };

    const handleRemove = (id: string) => {
        onChange(selectedIds.filter(selectedId => selectedId !== id));
    };

    const getOperatorName = (id: string) => {
        return operators.find(op => op.id === id)?.nombreCompleto || id;
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && search === '' && selectedIds.length > 0) {
            handleRemove(selectedIds[selectedIds.length - 1]);
        } else if (isOpen && filteredOperators.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setFocusedIndex(prev => prev < filteredOperators.length - 1 ? prev + 1 : prev);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setFocusedIndex(prev => prev > 0 ? prev - 1 : 0);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (focusedIndex >= 0) {
                    handleSelect(filteredOperators[focusedIndex].id);
                } else if (filteredOperators.length === 1) {
                    handleSelect(filteredOperators[0].id);
                }
            }
        }
    };

    return (
        <div className="w-full relative" ref={wrapperRef}>
            <div className="min-h-10 p-1.5 bg-background border rounded-md flex flex-wrap gap-1.5 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
                {selectedIds.map(id => (
                    <span key={id} className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary text-xs rounded-full">
                        {getOperatorName(id)}
                        <button 
                            type="button" 
                            onClick={() => handleRemove(id)}
                            className="hover:bg-primary/20 rounded-full p-0.5"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </span>
                ))}
                <input
                    type="text"
                    className="flex-1 min-w-[120px] outline-none text-sm px-1 bg-transparent"
                    placeholder={selectedIds.length === 0 ? placeholder : ''}
                    value={search}
                    onChange={e => {
                        setSearch(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                    onKeyDown={handleKeyDown}
                />
            </div>

            {isOpen && search && (
                <div className="absolute z-10 w-full mt-1 bg-card border rounded-md shadow-lg overflow-hidden">
                    {filteredOperators.length > 0 ? (
                        <ul className="max-h-48 overflow-y-auto py-1">
                            {filteredOperators.map((op, index) => (
                                <li 
                                    key={op.id}
                                    className={`px-3 py-2 text-sm cursor-pointer ${focusedIndex === index ? 'bg-muted' : 'hover:bg-muted'}`}
                                    onClick={() => handleSelect(op.id)}
                                >
                                    {op.nombreCompleto} {op.posicion ? <span className="text-muted-foreground text-xs">({op.posicion})</span> : ''}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="p-3 text-sm text-muted-foreground text-center">
                            No se encontraron operadores.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
