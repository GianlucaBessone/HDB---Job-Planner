'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { PackageSearch, Plus, Upload, Search, Loader2, Package, Boxes, Info } from 'lucide-react';
import { safeApiRequest } from '@/lib/offline';
import { showToast } from '@/components/Toast';
import { ViewConfig } from '@/lib/viewAccess';
import { useViewState } from '@/lib/hooks/useViewState';

interface Material {
    codigo: string;
    nombre: string;
    precioVenta: number | null;
    costo: number | null;
}

export default function InventarioPage() {
    const [materiales, setMateriales] = useState<Material[]>([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useViewState('inventario-filters', {
        searchTerm: '',
        searchMode: 'codigo' as 'codigo' | 'nombre'
    });
    const { searchTerm, searchMode } = filters;
    const setSearchTerm = (val: string) => setFilters({ searchTerm: val });
    const setSearchMode = (val: typeof searchMode) => setFilters({ searchMode: val });
    
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [viewConfig, setViewConfig] = useState<ViewConfig[] | null>(null);

    useEffect(() => {
        const u = localStorage.getItem('currentUser');
        if (u) setCurrentUser(JSON.parse(u));
        loadMateriales();
        fetch('/api/config/views')
            .then(r => r.json())
            .then(data => { if (Array.isArray(data) && data.length > 0) setViewConfig(data); })
            .catch(() => {});
    }, []);

    const loadMateriales = async () => {
        setLoading(true);
        try {
            const res = await safeApiRequest('/api/inventario');
            if (res.ok) setMateriales(await res.json());
        } catch {
            showToast('Error cargando inventario', 'error');
        } finally {
            setLoading(false);
        }
    };

    const filtered = useMemo(() => {
        const normalize = (s: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        const term = normalize(searchTerm).trim();
        if (!term) return materiales.slice(0, 100);

        if (searchMode === 'nombre') {
            return materiales.filter(m => normalize(m.nombre).includes(term)).slice(0, 100);
        } else {
            const termNoZeros = term.replace(/^0+/, '');
            
            let matches = materiales.filter(m => {
                const mCodeNoZeros = m.codigo.replace(/^0+/, '').toLowerCase();
                return mCodeNoZeros.startsWith(termNoZeros);
            });

            // Organizar de menor a mayor (numéricamente)
            matches.sort((a, b) => {
                const aCode = a.codigo.replace(/^0+/, '').toLowerCase();
                const bCode = b.codigo.replace(/^0+/, '').toLowerCase();
                if (aCode === termNoZeros) return -1;
                if (bCode === termNoZeros) return 1;
                return aCode.localeCompare(bCode, undefined, { numeric: true });
            });

            // Si hay coincidencia exacta, se reduce a 1 solo material
            const exactMatch = matches.find(m => m.codigo.replace(/^0+/, '').toLowerCase() === termNoZeros);
            if (exactMatch) {
                matches = [exactMatch];
            }

            return matches.slice(0, 100);
        }
    }, [materiales, searchTerm, searchMode]);

    const role = currentUser?.role?.trim().toLowerCase() || '';
    const [mostrarHeredados, setMostrarHeredados] = useState(false);

    return (
        <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
            {/* Banner de vista desactivada */}
            <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border-2 border-amber-500/30 rounded-[2rem] p-6 md:p-8 space-y-4 shadow-sm">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                            <PackageSearch className="w-8 h-8" />
                        </div>
                        <div>
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 mb-1">
                                Vista Desactivada Temporalmente
                            </div>
                            <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-slate-100">
                                Inventario de Materiales
                            </h2>
                            <p className="text-slate-600 dark:text-slate-400 text-xs md:text-sm font-medium mt-0.5 max-w-2xl">
                                Esta vista ha sido desactivada temporalmente. El maestro unificado de materiales, costos y listas de precios ahora se administra centralizadamente desde <strong className="text-slate-800 dark:text-slate-200">Gestión Comercial</strong>, y la provisión se realiza directamente en cada proyecto desde <strong className="text-slate-800 dark:text-slate-200">Provisión de Materiales</strong>.
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0 w-full md:w-auto">
                        <Link
                            href="/ventas/gestion"
                            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center gap-2 text-xs transition-all shadow-md shadow-emerald-600/20"
                        >
                            <Boxes className="w-4 h-4" /> Gestión Comercial
                        </Link>
                        <Link
                            href="/provision-materiales"
                            className="px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold flex items-center gap-2 text-xs transition-all shadow-md shadow-orange-600/20"
                        >
                            <Package className="w-4 h-4" /> Provisión de Materiales
                        </Link>
                    </div>
                </div>

                <div className="pt-2 border-t border-amber-500/20 flex items-center justify-between">
                    <p className="text-xs text-amber-700 dark:text-amber-300 font-semibold flex items-center gap-1.5">
                        <Info className="w-4 h-4 shrink-0" />
                        Los registros históricos de MaterialMaestro se preservan en modo solo lectura.
                    </p>
                    <button
                        onClick={() => setMostrarHeredados(!mostrarHeredados)}
                        className="text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-primary transition-colors underline"
                    >
                        {mostrarHeredados ? 'Ocultar datos heredados' : 'Ver datos heredados (solo lectura)'}
                    </button>
                </div>
            </div>

            {mostrarHeredados && (
                <div className="bg-card text-card-foreground border border-slate-200 dark:border-slate-700 rounded-[2rem] p-4 md:p-6 shadow-sm space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
                        <div>
                            <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">Registros Heredados (MaterialMaestro)</h3>
                            <p className="text-xs text-slate-400">Modo consulta histórico. No se permiten nuevas altas ni ediciones.</p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                disabled
                                title="Desactivado: Administrar desde Gestión Comercial"
                                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-xl font-bold flex items-center gap-1.5 text-xs opacity-60 cursor-not-allowed border border-slate-200 dark:border-slate-700"
                            >
                                <Upload className="w-3.5 h-3.5"/> Importar Excel
                            </button>
                            <button
                                disabled
                                title="Desactivado: Crear productos desde Gestión Comercial"
                                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-xl font-bold flex items-center gap-1.5 text-xs opacity-60 cursor-not-allowed border border-slate-200 dark:border-slate-700"
                            >
                                <Plus className="w-3.5 h-3.5"/> Nuevo Material
                            </button>
                        </div>
                    </div>
                <div className="flex flex-col md:flex-row gap-3">
                    <div className="relative group flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                        <input
                            type="text"
                            placeholder={searchMode === 'codigo' ? "Buscar por código (ej: 004 o 4)..." : "Buscar por nombre..."}
                            className="w-full bg-background text-foreground/50 border border-slate-200 dark:border-slate-700 rounded-xl py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm font-medium"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex bg-secondary text-secondary-foreground/50 p-1 rounded-xl w-fit border border-slate-200 dark:border-slate-700">
                        <button 
                            onClick={() => { setSearchMode('codigo'); setSearchTerm(''); }}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${searchMode === 'codigo' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Por Código
                        </button>
                        <button 
                            onClick={() => { setSearchMode('nombre'); setSearchTerm(''); }}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${searchMode === 'nombre' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Por Nombre
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>
                ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-background text-foreground/50 text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] tracking-widest border-b border-slate-200 dark:border-slate-700">
                                <tr>
                                    <th className="px-4 py-3">Código</th>
                                    <th className="px-4 py-3">Material</th>
                                    <th className="px-4 py-3 text-right">Precio Venta</th>
                                    <th className="px-4 py-3 text-right">Costo</th>
                                    <th className="px-4 py-3 text-center">Estado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-card text-card-foreground">
                                {filtered.length === 0 ? (
                                    <tr><td colSpan={5} className="py-8 text-center text-slate-500 font-medium">No se encontraron materiales</td></tr>
                                ) : filtered.map(m => (
                                    <tr key={m.codigo} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="px-4 py-3 font-mono text-xs font-bold text-slate-600 dark:text-slate-300">{m.codigo}</td>
                                        <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-100">{m.nombre}</td>
                                        <td className="px-4 py-3 text-right text-emerald-600 font-black">
                                            {m.precioVenta != null ? `$${m.precioVenta.toLocaleString('es-AR')}` : <span className="text-slate-300">—</span>}
                                        </td>
                                        <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300 font-bold">
                                            {m.costo != null ? `$${m.costo.toLocaleString('es-AR')}` : <span className="text-slate-300">—</span>}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                                                Solo Lectura
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            )}
        </div>
    );
}
