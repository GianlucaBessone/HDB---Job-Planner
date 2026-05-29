import { useState, useEffect } from 'react';
import { safeApiRequest } from '@/lib/offline';
import { History, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

let cachedHistoryVersions: any[] | null = null;

export default function HistoryTab({ user }: { user: any }) {
    const [recentVersions, setRecentVersions] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadHistory();
    }, []);

    const loadHistory = async () => {
        let showLoader = true;
        if (cachedHistoryVersions) {
            setRecentVersions(cachedHistoryVersions);
            showLoader = false;
        }
        if (showLoader) {
            setIsLoading(true);
        }
        try {
            const res = await safeApiRequest('/api/documentos/stats');
            if (res.ok) {
                const data = await res.json();
                const versions = data.recentVersions || [];
                cachedHistoryVersions = versions;
                setRecentVersions(versions);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-500" /> Historial de Cambios (QMS)
            </h3>

            {isLoading ? (
                <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>
            ) : recentVersions.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-12 text-center border border-slate-200 dark:border-slate-700">
                    <ShieldCheck className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm font-bold text-slate-500">No hay actividad registrada en el módulo.</p>
                </div>
            ) : (
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                    <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 dark:before:via-slate-700 before:to-transparent">
                        {recentVersions.map((v: any, i: number) => (
                            <div key={v.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white dark:border-slate-800 bg-primary text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                                    <ShieldCheck className="w-4 h-4" />
                                </div>
                                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="font-black text-sm text-slate-800 dark:text-slate-100">{v.document?.codigoDocumental} v{v.versionLabel}</div>
                                        <div className="text-[10px] font-bold text-slate-400">{format(new Date(v.createdAt), "dd MMM, yyyy", { locale: es })}</div>
                                    </div>
                                    <div className="text-xs font-medium text-slate-600 dark:text-slate-400 mt-1">
                                        {v.motivoCambio || 'Actualización de documento'}
                                    </div>
                                    <div className="text-[10px] font-bold text-slate-400 mt-2 flex justify-between">
                                        <span>Autor: {v.autorNombre || 'Sistema'}</span>
                                        <span className={`px-1.5 py-0.5 rounded ${v.estado === 'vigente' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600'}`}>
                                            {v.estado.toUpperCase()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
