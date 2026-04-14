'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Filter, Search, AlertTriangle, CheckCircle2, Clock, Package, Users, Landmark, Wrench, ChevronDown, ChevronUp, X, MapPin } from 'lucide-react';
import { safeApiRequest } from '@/lib/offline';
import { formatDateTime } from '@/lib/formatDate';
import SearchableSelect from '@/components/SearchableSelect';

interface Operator { id: string; nombreCompleto: string; }
interface Project { id: string; nombre: string; codigoProyecto?: string; }
interface Cart { id: string; nombre: string; }
interface MovementItem {
    id: string;
    nombre: string;
    cantidad: number;
    cantidadOut: number;
    cantidadIn: number | null;
    presentAtOut: boolean;
    presentAtIn: boolean | null;
    isAdditional: boolean;
}
interface Movement {
    id: string;
    cart: Cart;
    operator: { id: string; nombreCompleto: string; };
    project: { id: string; nombre: string; codigoProyecto?: string; };
    fechaSalida: string;
    fechaDevolucion: string | null;
    estado: string;
    items: MovementItem[];
}

export default function CarrosHistorialPage() {
    const router = useRouter();
    const [currentUser, setCurrentUser] = useState<any>(null);

    // Data
    const [movements, setMovements] = useState<Movement[]>([]);
    const [operators, setOperators] = useState<Operator[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [carts, setCarts] = useState<Cart[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Filters
    const [filterOperator, setFilterOperator] = useState('');
    const [filterProject, setFilterProject] = useState('');
    const [filterCart, setFilterCart] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    // Traceability
    const [traceToolName, setTraceToolName] = useState('');
    const [traceActive, setTraceActive] = useState(false);

    // Expand/collapse
    const [expandedMovements, setExpandedMovements] = useState<Set<string>>(new Set());

    useEffect(() => {
        const stored = localStorage.getItem('currentUser');
        if (stored) {
            const user = JSON.parse(stored);
            const role = user?.role?.toLowerCase();
            if (role !== 'supervisor' && role !== 'admin') {
                router.replace('/');
                return;
            }
            setCurrentUser(user);
        } else {
            router.replace('/');
        }
    }, [router]);

    useEffect(() => {
        if (!currentUser) return;
        Promise.all([
            loadMovements(),
            loadOperators(),
            loadProjects(),
            loadCarts()
        ]).finally(() => setIsLoading(false));
    }, [currentUser]);

    const loadMovements = async () => {
        try {
            const params = new URLSearchParams();
            if (filterOperator) params.set('operatorId', filterOperator);
            if (filterProject) params.set('projectId', filterProject);
            if (filterCart) params.set('cartId', filterCart);
            if (traceActive && traceToolName.trim()) params.set('toolName', traceToolName.trim());

            const res = await safeApiRequest(`/api/carros/movements/history?${params.toString()}`);
            if (res.ok) setMovements(await res.json());
        } catch (e) {
            console.error('Failed to load movements history');
        }
    };

    const loadOperators = async () => {
        try {
            const res = await safeApiRequest('/api/operators');
            if (res.ok) {
                const data = await res.json();
                setOperators(data.filter((o: any) => o.activo));
            }
        } catch (e) { console.error(e); }
    };

    const loadProjects = async () => {
        try {
            const res = await safeApiRequest('/api/projects');
            if (res.ok) setProjects(await res.json());
        } catch (e) { console.error(e); }
    };

    const loadCarts = async () => {
        try {
            const res = await safeApiRequest('/api/carros');
            if (res.ok) setCarts(await res.json());
        } catch (e) { console.error(e); }
    };

    const applyFilters = () => {
        setIsLoading(true);
        loadMovements().finally(() => setIsLoading(false));
    };

    const clearFilters = () => {
        setFilterOperator('');
        setFilterProject('');
        setFilterCart('');
        setTraceToolName('');
        setTraceActive(false);
        setIsLoading(true);
        // Load without filters
        safeApiRequest('/api/carros/movements/history')
            .then(async res => {
                if (res.ok) setMovements(await res.json());
            })
            .finally(() => setIsLoading(false));
    };

    const toggleExpanded = (id: string) => {
        setExpandedMovements(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // Unique tool names for traceability dropdown
    const allToolNames = useMemo(() => {
        const names = new Set<string>();
        movements.forEach(m => m.items.forEach(i => names.add(i.nombre)));
        return Array.from(names).sort();
    }, [movements]);

    // Summary stats
    const totalMovements = movements.length;
    const activeCount = movements.filter(m => m.estado === 'ACTIVO').length;
    const withMissingTools = movements.filter(m =>
        m.items.some(i => {
            if (m.estado === 'COMPLETADO') return (i.cantidadIn ?? 0) < i.cantidad;
            return (i.cantidadOut ?? 0) < i.cantidad;
        })
    ).length;

    // Traceability: filter movements to those containing the traced tool with discrepancy
    const traceResults = useMemo(() => {
        if (!traceActive || !traceToolName.trim()) return null;
        const name = traceToolName.trim().toLowerCase();
        return movements
            .filter(m => m.items.some(i => i.nombre.toLowerCase().includes(name)))
            .map(m => {
                const matchingItems = m.items.filter(i => i.nombre.toLowerCase().includes(name));
                return { ...m, matchingItems };
            });
    }, [movements, traceActive, traceToolName]);

    if (!currentUser) return null;

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-20">
            {/* Header */}
            <div className="bg-gradient-to-r from-primary to-blue-700 px-4 py-5 shadow-lg sticky top-0 z-50">
                <div className="flex items-center gap-4 max-w-5xl mx-auto w-full">
                    <button type="button" onClick={() => router.push('/')} className="text-white hover:bg-white/20 p-2 rounded-full transition-colors">
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <div className="flex-1">
                        <h1 className="text-xl font-black text-white tracking-tight">Historial de Carros</h1>
                        <p className="text-[10px] font-bold text-blue-200 uppercase tracking-widest">Supervisor</p>
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto w-full p-4 space-y-6 mt-2">

                {/* Stats Cards */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 text-center">
                        <p className="text-2xl font-black text-slate-800 dark:text-slate-100">{totalMovements}</p>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1">Movimientos</p>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 text-center">
                        <p className="text-2xl font-black text-blue-600">{activeCount}</p>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1">En Uso</p>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 text-center">
                        <p className="text-2xl font-black text-red-500">{withMissingTools}</p>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1">Con Faltantes</p>
                    </div>
                </div>

                {/* Filters Toggle */}
                <div className="space-y-3">
                    <button
                        type="button"
                        onClick={() => setShowFilters(!showFilters)}
                        className="w-full bg-white dark:bg-slate-800 rounded-2xl px-5 py-4 shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-between transition-all hover:shadow-md"
                    >
                        <span className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                            <Filter className="w-4 h-4 text-primary" />
                            Filtros
                            {(filterOperator || filterProject || filterCart) && (
                                <span className="bg-primary text-white text-[9px] font-black px-1.5 py-0.5 rounded-md">ACTIVO</span>
                            )}
                        </span>
                        {showFilters ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </button>

                    {showFilters && (
                        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-700 space-y-4 animate-in slide-in-from-top-2 duration-200">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">
                                        <Users className="w-3 h-3 inline mr-1" />Operador
                                    </label>
                                    <select
                                        value={filterOperator}
                                        onChange={e => setFilterOperator(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:border-primary"
                                    >
                                        <option value="">Todos</option>
                                        {operators.map(o => (
                                            <option key={o.id} value={o.id}>{o.nombreCompleto}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">
                                        <Landmark className="w-3 h-3 inline mr-1" />Obra / Proyecto
                                    </label>
                                    <select
                                        value={filterProject}
                                        onChange={e => setFilterProject(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:border-primary"
                                    >
                                        <option value="">Todos</option>
                                        {projects.map(p => (
                                            <option key={p.id} value={p.id}>{p.nombre}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">
                                        <Package className="w-3 h-3 inline mr-1" />Carro
                                    </label>
                                    <select
                                        value={filterCart}
                                        onChange={e => setFilterCart(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:border-primary"
                                    >
                                        <option value="">Todos</option>
                                        {carts.map(c => (
                                            <option key={c.id} value={c.id}>{c.nombre}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={applyFilters}
                                    className="flex-1 py-3 bg-primary text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-primary/90 transition-all flex items-center justify-center gap-2 active:scale-95"
                                >
                                    <Search className="w-4 h-4" /> Buscar
                                </button>
                                <button
                                    type="button"
                                    onClick={clearFilters}
                                    className="py-3 px-5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-600 transition-all flex items-center justify-center gap-2 active:scale-95"
                                >
                                    <X className="w-4 h-4" /> Limpiar
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Traceability Section */}
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-2xl p-5 shadow-sm border border-amber-200 dark:border-amber-800">
                    <h3 className="text-sm font-black text-amber-800 dark:text-amber-300 flex items-center gap-2 mb-3">
                        <MapPin className="w-4 h-4" /> Trazabilidad de Herramienta
                    </h3>
                    <p className="text-xs text-amber-700 dark:text-amber-400 font-medium mb-3">
                        Seleccioná una herramienta para ver todos los movimientos donde participó y si no fue devuelta.
                    </p>
                    <div className="flex gap-2 items-end">
                        <div className="flex-1">
                            <SearchableSelect
                                options={allToolNames.map(name => ({ id: name, label: name }))}
                                value={traceToolName}
                                onChange={setTraceToolName}
                                placeholder="Buscar herramienta..."
                            />
                        </div>
                        <button
                            type="button"
                            disabled={!traceToolName.trim()}
                            onClick={() => { setTraceActive(true); applyFilters(); }}
                            className="h-[44px] md:h-[50px] py-2.5 px-5 bg-amber-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-amber-500 transition-all disabled:opacity-40 active:scale-95"
                        >
                            Rastrear
                        </button>
                    </div>

                    {traceActive && traceToolName && (
                        <div className="mt-4">
                            <button
                                type="button"
                                onClick={() => { setTraceActive(false); setTraceToolName(''); applyFilters(); }}
                                className="text-xs font-bold text-amber-600 dark:text-amber-400 underline mb-3 block"
                            >
                                ← Cerrar trazabilidad
                            </button>
                        </div>
                    )}
                </div>

                {/* Traceability Results */}
                {traceActive && traceResults && (
                    <div className="space-y-3 animate-in fade-in duration-300">
                        <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-amber-500" />
                            Trazabilidad: &quot;{traceToolName}&quot;
                            <span className="text-[10px] bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-md">{traceResults.length} movimiento(s)</span>
                        </h3>

                        {traceResults.length === 0 ? (
                            <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 text-center border border-slate-200 dark:border-slate-700">
                                <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                <p className="text-sm font-bold text-slate-400">No se encontraron movimientos para esta herramienta.</p>
                            </div>
                        ) : (
                            traceResults.map(mov => {
                                const isActive = mov.estado === 'ACTIVO';
                                return (
                                    <div key={`trace-${mov.id}`} className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-700">
                                        <div className="flex items-start justify-between gap-3 mb-3">
                                            <div>
                                                <p className="font-black text-slate-800 dark:text-slate-100">{mov.cart.nombre}</p>
                                                <p className="text-xs font-medium text-slate-500">{mov.operator.nombreCompleto} → {mov.project.nombre}</p>
                                            </div>
                                            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${isActive
                                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                                : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                            }`}>
                                                {isActive ? 'En Uso' : 'Devuelto'}
                                            </span>
                                        </div>
                                        <div className="text-[10px] font-bold text-slate-400 space-y-0.5 mb-3">
                                            <p>Salida: {formatDateTime(mov.fechaSalida)}</p>
                                            <p>Devolución: {mov.fechaDevolucion ? formatDateTime(mov.fechaDevolucion) : '—'}</p>
                                        </div>
                                        <div className="space-y-2">
                                            {mov.matchingItems.map(item => {
                                                const notReturned = item.cantidadIn === null || item.cantidadIn < item.cantidad;
                                                return (
                                                    <div key={item.id} className={`p-3 rounded-xl text-xs ${notReturned
                                                        ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                                                        : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                                                    }`}>
                                                        <div className="flex items-center gap-2">
                                                            {notReturned
                                                                ? <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                                                                : <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                                                            }
                                                            <span className="font-black text-slate-800 dark:text-slate-100 break-words">{item.nombre}</span>
                                                        </div>
                                                        <div className="mt-1 pl-5 text-[10px] font-bold text-slate-500 space-y-0.5">
                                                            <p>Esperado: {item.cantidad} | Salida: {item.cantidadOut}</p>
                                                            <p>Devolución: {item.cantidadIn !== null ? item.cantidadIn : 'Pendiente'}</p>
                                                            {notReturned && (
                                                                <p className="text-red-500 font-black uppercase">
                                                                    ⚠ {item.cantidadIn === null
                                                                        ? 'No devuelta aún'
                                                                        : `Faltan ${item.cantidad - item.cantidadIn} unidades`
                                                                    }
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}

                {/* Movement History List */}
                {!traceActive && (
                    <div className="space-y-3">
                        <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest flex items-center gap-2">
                            <Clock className="w-4 h-4 text-primary" /> Historial de Movimientos
                        </h3>

                        {isLoading ? (
                            <div className="flex items-center justify-center py-16">
                                <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                            </div>
                        ) : movements.length === 0 ? (
                            <div className="bg-white dark:bg-slate-800 rounded-2xl p-12 text-center border border-slate-200 dark:border-slate-700">
                                <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                                <p className="text-sm font-bold text-slate-400">No se encontraron movimientos.</p>
                            </div>
                        ) : (
                            movements.map(mov => {
                                const isActive = mov.estado === 'ACTIVO';
                                const isExpanded = expandedMovements.has(mov.id);
                                const hasMissing = mov.items.some(i => {
                                    if (isActive) return (i.cantidadOut ?? 0) < i.cantidad;
                                    return (i.cantidadIn ?? 0) < i.cantidad;
                                });

                                return (
                                    <div key={mov.id} className={`bg-white dark:bg-slate-800 rounded-2xl shadow-sm border transition-all ${hasMissing
                                        ? 'border-red-200 dark:border-red-800'
                                        : 'border-slate-200 dark:border-slate-700'
                                    }`}>
                                        <button
                                            type="button"
                                            onClick={() => toggleExpanded(mov.id)}
                                            className="w-full p-5 text-left"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="font-black text-slate-800 dark:text-slate-100 text-base">{mov.cart.nombre}</span>
                                                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${isActive
                                                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                                            : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                        }`}>
                                                            {isActive ? 'En Uso' : 'Devuelto'}
                                                        </span>
                                                        {hasMissing && (
                                                            <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 flex items-center gap-1">
                                                                <AlertTriangle className="w-3 h-3" /> Faltantes
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs font-medium text-slate-500 mt-1">
                                                        <span className="font-bold text-slate-600 dark:text-slate-300">{mov.operator.nombreCompleto}</span>
                                                        {' → '}
                                                        {mov.project.nombre}
                                                    </p>
                                                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5">
                                                        <span className="text-[10px] font-bold text-slate-400">Salida: {formatDateTime(mov.fechaSalida)}</span>
                                                        <span className="text-[10px] font-bold text-slate-400">
                                                            Devolución: {mov.fechaDevolucion ? formatDateTime(mov.fechaDevolucion) : '—'}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="pt-1">
                                                    {isExpanded
                                                        ? <ChevronUp className="w-5 h-5 text-slate-400" />
                                                        : <ChevronDown className="w-5 h-5 text-slate-400" />
                                                    }
                                                </div>
                                            </div>
                                        </button>

                                        {isExpanded && (
                                            <div className="px-5 pb-5 pt-0 border-t border-slate-100 dark:border-slate-800 animate-in slide-in-from-top-2 duration-200">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 mt-4">Herramientas</p>
                                                <div className="space-y-2">
                                                    {mov.items.map(item => {
                                                        const missingOut = (item.cantidadOut ?? 0) < item.cantidad;
                                                        const missingIn = mov.estado === 'COMPLETADO' && (item.cantidadIn ?? 0) < item.cantidad;
                                                        const isMissing = missingOut || missingIn;

                                                        return (
                                                            <div key={item.id} className={`p-3 rounded-xl text-xs flex items-start gap-3 ${isMissing
                                                                ? 'bg-red-50 dark:bg-red-900/15 border border-red-200 dark:border-red-800'
                                                                : 'bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-700'
                                                            }`}>
                                                                {isMissing
                                                                    ? <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                                                                    : <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                                                                }
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="font-black text-slate-800 dark:text-slate-100 break-words">{item.nombre}
                                                                        {item.isAdditional && <span className="ml-1 text-[9px] font-bold text-blue-500">(adicional)</span>}
                                                                    </p>
                                                                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[10px] font-bold text-slate-500">
                                                                        <span>Esperado: {item.cantidad}</span>
                                                                        <span>Salida: <span className={missingOut ? 'text-red-500' : ''}>{item.cantidadOut}</span></span>
                                                                        {mov.estado === 'COMPLETADO' && (
                                                                            <span>Devolución: <span className={missingIn ? 'text-red-500' : ''}>{item.cantidadIn ?? '—'}</span></span>
                                                                        )}
                                                                    </div>
                                                                    {missingOut && (
                                                                        <p className="text-[10px] font-black text-red-500 mt-1">
                                                                            ⚠ Faltaron {item.cantidad - (item.cantidadOut ?? 0)} a la salida
                                                                        </p>
                                                                    )}
                                                                    {missingIn && (
                                                                        <p className="text-[10px] font-black text-red-500 mt-0.5">
                                                                            ⚠ Faltaron {item.cantidad - (item.cantidadIn ?? 0)} a la devolución
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
