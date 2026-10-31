'use client';
import { useState, useEffect, useRef } from 'react';
import { AlertCircle, ChevronDown, Loader2, Lock, LogIn, User as UserIcon } from 'lucide-react';
import { BrandMark } from '@/components/shell/BrandMark';
import { safeApiRequest } from '@/lib/offline';

export default function LoginScreen({ onLoginSuccess }: { onLoginSuccess: (user: any) => void }) {
    const [operators, setOperators] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [selectedOperatorId, setSelectedOperatorId] = useState('');
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        // Load operators
        safeApiRequest('/api/operators')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    setOperators(data);
                    // check cache for last user
                    const lastUser = localStorage.getItem('lastActiveUserId');
                    if (lastUser && data.find((o: any) => o.id === lastUser)) {
                        setSelectedOperatorId(lastUser);
                    }
                } else {
                    console.error('Expected array of operators, got:', data);
                    setOperators([]);
                }
                setIsLoading(false);
            })
            .catch(err => {
                console.error(err);
                setIsLoading(false);
            });
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);

        try {
            const res = await safeApiRequest('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ operatorId: selectedOperatorId, pin })
            });

            if (!res.ok) {
                const errData = await res.json();
                setError(errData.error || 'Autenticación fallida');
                setPin('');
                setIsSubmitting(false);
                return;
            }

            const userData = await res.json();
            // Cache last used user simply by ID
            localStorage.setItem('lastActiveUserId', userData.id);
            // Save current session
            localStorage.setItem('currentUser', JSON.stringify(userData));

            onLoginSuccess(userData);
        } catch (err) {
            setError('Error de conexión');
            setPin('');
            setIsSubmitting(false);
        }
    };

    const normalize = (s: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const filteredOperators = operators.filter(o => normalize(o?.nombreCompleto).includes(normalize(searchTerm)));

    // ── Custom inline dropdown state ──────────────────────────────────────────
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const selectedOp = operators.find(o => o.id === selectedOperatorId);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Focus input when dropdown is opened
    useEffect(() => {
        if (dropdownOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [dropdownOpen]);

    if (isLoading) {
        return (
            <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-6 bg-background" role="status" aria-label="Cargando usuarios">
                <BrandMark className="w-12 h-12 rounded-xl" />
                <Loader2 className="w-5 h-5 animate-spin text-slate-400" aria-hidden="true" />
            </div>
        );
    }

    return (
        <div className="min-h-[100dvh] bg-background text-foreground grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            {/* Panel de marca (solo escritorio) */}
            <aside className="hidden lg:flex flex-col justify-between p-12 bg-neutral-900 text-neutral-100 dark:bg-neutral-900">
                <div className="flex items-center gap-3">
                    <BrandMark className="w-9 h-9 rounded-xl" />
                    <span className="text-lg font-semibold tracking-tight">HDB <span className="font-normal text-neutral-400">SGI</span></span>
                </div>
                <div className="max-w-md">
                    <p className="text-display text-white">Sistema de Gestión Integral</p>
                    <p className="mt-3 text-body text-neutral-400">
                        Órdenes, proyectos, calidad, stock y personal de HDB Servicios Eléctricos en un solo lugar.
                    </p>
                </div>
                <p className="text-xs text-neutral-500">HDB SGI · ISO 9001</p>
            </aside>

            <main className="flex items-center justify-center p-5 sm:p-10">
                <div className="w-full max-w-sm">
                    <div className="lg:hidden flex items-center gap-2.5 mb-10">
                        <BrandMark className="w-9 h-9 rounded-xl" />
                        <span className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50">HDB <span className="font-normal text-slate-500">SGI</span></span>
                    </div>

                    <h1 className="text-title text-slate-900 dark:text-slate-50">Ingresar</h1>
                    <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">Elegí tu usuario e ingresá tu PIN.</p>

                    <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
                        {/* Selector de usuario con búsqueda */}
                        <div>
                            <label htmlFor="login-operador" className="field-label">Usuario</label>
                            <div className="relative" ref={containerRef}>
                                <div className="relative flex items-center">
                                    <UserIcon className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" aria-hidden="true" />
                                    <input
                                        id="login-operador"
                                        ref={inputRef}
                                        type="text"
                                        role="combobox"
                                        aria-expanded={dropdownOpen}
                                        aria-controls="login-operador-lista"
                                        aria-autocomplete="list"
                                        autoComplete="off"
                                        placeholder={dropdownOpen ? 'Escribí para buscar…' : (selectedOp ? selectedOp.nombreCompleto : 'Seleccionar usuario')}
                                        className={`input h-11 !pl-9 pr-9 ${dropdownOpen ? '' : 'cursor-pointer'}`}
                                        value={dropdownOpen ? searchTerm : (selectedOp ? selectedOp.nombreCompleto : '')}
                                        onChange={(e) => {
                                            if (dropdownOpen) {
                                                setSearchTerm(e.target.value);
                                            }
                                        }}
                                        onClick={() => {
                                            if (!dropdownOpen) {
                                                setDropdownOpen(true);
                                                setSelectedOperatorId('');
                                                setSearchTerm('');
                                            }
                                        }}
                                        onKeyDown={(e) => {
                                            if (!dropdownOpen && (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === ' ')) {
                                                e.preventDefault();
                                                setDropdownOpen(true);
                                                setSelectedOperatorId('');
                                                setSearchTerm('');
                                            } else if (dropdownOpen && e.key === 'Escape') {
                                                setDropdownOpen(false);
                                            } else if (dropdownOpen && e.key === 'Enter' && filteredOperators.length === 1) {
                                                e.preventDefault();
                                                setSelectedOperatorId(filteredOperators[0].id);
                                                setDropdownOpen(false);
                                                setSearchTerm('');
                                            }
                                        }}
                                        readOnly={!dropdownOpen}
                                    />
                                    <ChevronDown className={`absolute right-3 w-4 h-4 text-slate-400 pointer-events-none transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                                </div>

                                {dropdownOpen && (
                                    <div
                                        id="login-operador-lista"
                                        role="listbox"
                                        aria-label="Usuarios"
                                        className="absolute z-50 left-0 right-0 mt-1.5 bg-popover text-popover-foreground border border-border rounded-xl shadow-xl overflow-hidden animate-in fade-in duration-150"
                                    >
                                        <div className="max-h-60 overflow-y-auto p-1">
                                            {filteredOperators.length === 0 ? (
                                                <p className="px-3 py-4 text-center text-[13px] text-slate-500">Sin resultados para "{searchTerm}"</p>
                                            ) : filteredOperators.map(op => (
                                                <button
                                                    key={op.id}
                                                    type="button"
                                                    role="option"
                                                    aria-selected={selectedOperatorId === op.id}
                                                    onClick={() => {
                                                        setSelectedOperatorId(op.id);
                                                        setDropdownOpen(false);
                                                        setSearchTerm('');
                                                    }}
                                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors whitespace-normal break-words focus:bg-brand-50 dark:focus:bg-brand-950 ${selectedOperatorId === op.id ? 'bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-100' : 'text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                                                >
                                                    {op.nombreCompleto}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* PIN */}
                        <div>
                            <label htmlFor="login-pin" className="field-label">PIN</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" aria-hidden="true" />
                                <input
                                    id="login-pin"
                                    type="password"
                                    required
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    maxLength={8}
                                    autoComplete="current-password"
                                    placeholder="••••••"
                                    aria-invalid={error ? true : undefined}
                                    aria-describedby={error ? 'login-error' : undefined}
                                    className="input h-11 !pl-9 text-lg tracking-wider font-mono"
                                    value={pin}
                                    onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                                />
                            </div>
                        </div>

                        {error && (
                            <div id="login-error" role="alert" className="flex items-start gap-2 p-3 rounded-lg border border-danger-200 bg-danger-50 text-danger-800 dark:border-danger-900 dark:bg-danger-950 dark:text-danger-200">
                                <AlertCircle className="w-4 h-4 mt-px shrink-0" aria-hidden="true" />
                                <p className="text-[13px] font-medium">{error}</p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isSubmitting || !selectedOperatorId || !pin}
                            className="btn btn-primary btn-lg w-full"
                        >
                            {isSubmitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : <LogIn aria-hidden="true" />}
                            {isSubmitting ? 'Ingresando…' : 'Ingresar'}
                        </button>
                    </form>
                </div>
            </main>
        </div>
    );
}
