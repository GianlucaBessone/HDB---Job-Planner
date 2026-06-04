import { useState, useEffect } from 'react';
import { safeApiRequest } from '@/lib/offline';
import { FileText, AlertCircle, ShieldCheck, FileWarning, Clock, BookOpen, History } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

let cachedDashboardStats: any = null;

export default function DashboardTab({ user }: { user: any }) {
    const [stats, setStats] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        let showLoader = true;
        if (cachedDashboardStats) {
            setStats(cachedDashboardStats);
            showLoader = false;
        }
        if (showLoader) {
            setIsLoading(true);
        }
        try {
            const res = await safeApiRequest('/api/documentos/stats');
            if (res.ok) {
                const data = await res.json();
                cachedDashboardStats = data;
                setStats(data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading || !stats) {
        return (
            <div className="flex justify-center items-center py-20">
                <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
        );
    }

    const { totals, byType, byArea, recentVersions } = stats;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                <div className="bg-white dark:bg-slate-800 p-2.5 md:p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-center h-[64px] md:h-[72px]">
                    <div className="flex items-center gap-1.5 mb-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                        <p className="text-[10px] md:text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest truncate">Vigentes</p>
                    </div>
                    <p className="text-lg md:text-xl font-black text-slate-800 dark:text-slate-100 tabular-nums leading-none">{totals.vigentes}</p>
                </div>
                
                <div className="bg-white dark:bg-slate-800 p-2.5 md:p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-center h-[64px] md:h-[72px]">
                    <div className="flex items-center gap-1.5 mb-1">
                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                        <p className="text-[10px] md:text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest truncate">En Revisión</p>
                    </div>
                    <p className="text-lg md:text-xl font-black text-slate-800 dark:text-slate-100 tabular-nums leading-none">{totals.enRevision + totals.borradores}</p>
                </div>

                <div className="bg-white dark:bg-slate-800 p-2.5 md:p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-center h-[64px] md:h-[72px]">
                    <div className="flex items-center gap-1.5 mb-1">
                        <FileWarning className="w-3.5 h-3.5 text-rose-500" />
                        <p className="text-[10px] md:text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest truncate">Vencidos</p>
                    </div>
                    <p className="text-lg md:text-xl font-black text-slate-800 dark:text-slate-100 tabular-nums leading-none">{totals.vencidos}</p>
                </div>

                <div className="bg-white dark:bg-slate-800 p-2.5 md:p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-center h-[64px] md:h-[72px]">
                    <div className="flex items-center gap-1.5 mb-1">
                        <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                        <p className="text-[10px] md:text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest truncate">Confirmaciones</p>
                    </div>
                    <p className="text-lg md:text-xl font-black text-slate-800 dark:text-slate-100 tabular-nums leading-none">{totals.confirmacionesPendientes}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
                    <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 mb-4 uppercase tracking-widest flex items-center gap-2">
                        <FileText className="w-4 h-4 text-primary" /> Documentos por Tipo
                    </h3>
                    <div className="space-y-3">
                        {byType.map((item: any) => (
                            <div key={item.tipo} className="flex items-center justify-between">
                                <span className="text-sm font-bold text-slate-600 dark:text-slate-300">{item.tipo}</span>
                                <span className="text-sm font-black text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-md">{item.count}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
                    <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 mb-4 uppercase tracking-widest flex items-center gap-2">
                        <History className="w-4 h-4 text-primary" /> Actividad Reciente
                    </h3>
                    <div className="space-y-4">
                        {recentVersions.map((v: any) => (
                            <div key={v.id} className="flex gap-3">
                                <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                                <div>
                                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                        Versión {v.versionLabel} de {v.document?.codigoDocumental}
                                    </p>
                                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                                        {v.autorNombre || 'Sistema'} • {format(new Date(v.createdAt), "d MMM, yyyy HH:mm", { locale: es })}
                                    </p>
                                </div>
                            </div>
                        ))}
                        {recentVersions.length === 0 && (
                            <p className="text-sm font-medium text-slate-500">No hay actividad reciente.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
