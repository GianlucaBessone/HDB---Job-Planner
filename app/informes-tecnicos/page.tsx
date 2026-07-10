'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import {
    FileText, Search, Eye, Download, CheckCircle2,
    AlertCircle, Plus, Building2, User
} from 'lucide-react';
import Link from 'next/link';
import { formatDate } from '@/lib/formatDate';
import { safeApiRequest } from '@/lib/offline';
import { showToast } from '@/components/Toast';
import { ViewConfig, isViewAllowed } from '@/lib/viewAccess';

export default function InformesTecnicosContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    const [informes, setInformes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterEstado, setFilterEstado] = useState<'all' | 'borrador' | 'finalizado' | 'anulado'>('all');

    const [currentUser, setCurrentUser] = useState<any>(null);
    const [viewConfig, setViewConfig] = useState<ViewConfig[] | null>(null);

    useEffect(() => {
        const user = localStorage.getItem('currentUser');
        if (user) setCurrentUser(JSON.parse(user));
        loadInformes();
        fetch('/api/config/views')
            .then(r => r.json())
            .then(data => { if (Array.isArray(data) && data.length > 0) setViewConfig(data); })
            .catch(() => {});
    }, []);

    const loadInformes = async () => {
        setLoading(true);
        try {
            const res = await safeApiRequest('/api/informes-tecnicos');
            const data = await res.json();
            if (Array.isArray(data)) setInformes(data);
        } catch {
            showToast('Error al cargar informes técnicos', 'error');
        } finally {
            setLoading(false);
        }
    };

    const role = currentUser?.role?.trim().toLowerCase() || '';
    const isAllowed = !role || !viewConfig || isViewAllowed('/informes-tecnicos', role, 'sidebar', viewConfig);

    if (!loading && !isAllowed) {
        return (
            <div className="max-w-2xl mx-auto py-20 text-center space-y-4">
                <AlertCircle className="w-12 h-12 text-slate-300 mx-auto" />
                <p className="text-slate-500 font-medium">No tenés permisos para acceder a esta sección.</p>
            </div>
        );
    }

    const filtered = informes.filter(inf => {
        const normalize = (s: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        const term = normalize(searchTerm);
        const matchSearch = !searchTerm ||
            normalize(inf.project?.nombre).includes(term) ||
            normalize(inf.client?.nombre).includes(term) ||
            normalize(inf.reportNumber).includes(term);
        const matchEstado = filterEstado === 'all' || inf.status === filterEstado;
        
        return matchSearch && matchEstado;
    });

    return (
        <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight flex items-center gap-2 md:gap-3">
                        <FileText className="w-6 h-6 md:w-8 md:h-8 text-primary" />
                        Informes Técnicos
                    </h2>
                    <p className="text-sm text-slate-500 font-medium">Relevamientos, diagnósticos y mantenimientos.</p>
                </div>
                <Link
                    href="/informes-tecnicos/nuevo"
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white rounded-2xl font-black text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                >
                    <Plus className="w-5 h-5" />
                    Nuevo Informe
                </Link>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 min-w-0 group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                    <input
                        type="text"
                        placeholder="Buscar por código IT, proyecto o cliente..."
                        className="w-full bg-card border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium shadow-sm"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex gap-1.5 bg-card border border-slate-200 dark:border-slate-700 rounded-xl p-1 shadow-sm shrink-0">
                    {(['all', 'borrador', 'finalizado'] as const).map(estado => (
                        <button
                            key={estado}
                            onClick={() => setFilterEstado(estado)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterEstado === estado
                                ? estado === 'finalizado' ? 'bg-emerald-100 text-emerald-700'
                                    : estado === 'borrador' ? 'bg-amber-100 text-amber-700'
                                            : 'bg-primary text-white'
                                : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                                }`}
                        >
                            {estado === 'all' ? 'Todos' : estado === 'finalizado' ? 'Finalizados' : 'Borradores'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            {loading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted rounded-2xl animate-pulse" />)}
                </div>
            ) : filtered.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center bg-card border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-400">
                    <FileText className="w-12 h-12 mb-4 opacity-20" />
                    <p className="font-semibold text-slate-600">No se encontraron informes técnicos</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.map(inf => (
                        <div key={inf.id} className="bg-card border border-slate-200 dark:border-slate-700 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row gap-4 sm:items-center justify-between hover:border-primary/30 transition-all group">
                            <div className="flex flex-col min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{formatDate(inf.createdAt)}</span>
                                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                                        inf.status === 'finalizado' ? 'bg-emerald-100 text-emerald-700' :
                                        inf.status === 'borrador' ? 'bg-amber-100 text-amber-700' :
                                        'bg-slate-100 text-slate-700'
                                    }`}>
                                        {inf.status === 'finalizado' ? '✓ Finalizado' : 'Borrador'}
                                    </span>
                                </div>
                                <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-2 truncate">
                                    <span className="text-primary font-mono shrink-0">{inf.reportNumber}</span>
                                    <span className="text-slate-300">|</span>
                                    <span className="truncate" title={inf.template?.name}>{inf.template?.name}</span>
                                </h3>
                                <div className="flex items-center gap-4 mt-2">
                                    <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5 truncate" title={inf.project?.nombre}>
                                        <Building2 className="w-3.5 h-3.5" />
                                        <span className="truncate">{inf.project?.nombre || inf.client?.nombre || 'General'}</span>
                                    </p>
                                    {inf.responsable && (
                                        <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
                                            <User className="w-3.5 h-3.5" />
                                            {inf.responsable.nombreCompleto}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-2 sm:shrink-0 w-full sm:w-auto">
                                {inf.status === 'finalizado' ? (
                                    <a
                                        href={`/api/informes-tecnicos/${inf.id}/pdf`}
                                        target="_blank"
                                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 rounded-xl font-bold text-xs transition-colors"
                                    >
                                        <Download className="w-4 h-4" /> PDF
                                    </a>
                                ) : null}
                                <Link
                                    href={`/informes-tecnicos/${inf.id}`}
                                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-xl font-bold text-xs transition-colors"
                                >
                                    <Eye className="w-4 h-4" /> {inf.status === 'borrador' ? 'Editar' : 'Ver'}
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
