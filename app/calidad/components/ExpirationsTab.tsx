import { useState, useEffect } from 'react';
import { safeApiRequest } from '@/lib/offline';
import { AlertTriangle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

let cachedExpirationsDocs: any[] | null = null;

export default function ExpirationsTab({ user }: { user: any }) {
    const [docs, setDocs] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadExpirations();
    }, []);

    const loadExpirations = async () => {
        let showLoader = true;
        if (cachedExpirationsDocs) {
            setDocs(cachedExpirationsDocs);
            showLoader = false;
        }
        if (showLoader) {
            setIsLoading(true);
        }
        try {
            const res = await safeApiRequest('/api/documentos?vencidos=true');
            if (res.ok) {
                const data = await res.json();
                cachedExpirationsDocs = data;
                setDocs(data);
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
                <AlertTriangle className="w-5 h-5 text-amber-500" /> Próximos Vencimientos y Revisiones
            </h3>

            {isLoading ? (
                <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>
            ) : docs.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-12 text-center border border-slate-200 dark:border-slate-700">
                    <Clock className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                    <p className="text-sm font-bold text-slate-500">No hay documentos vencidos ni próximos a vencer.</p>
                </div>
            ) : (
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 text-[10px] uppercase tracking-widest text-slate-500">
                                <th className="p-4 font-black">Documento</th>
                                <th className="p-4 font-black">Próx. Revisión</th>
                                <th className="p-4 font-black">Estado</th>
                                <th className="p-4 font-black text-right">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                            {docs.map(doc => (
                                <tr key={doc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                    <td className="p-4">
                                        <div className="font-bold text-sm text-slate-800 dark:text-slate-200">{doc.titulo}</div>
                                        <div className="text-xs text-slate-500 font-mono mt-0.5">{doc.codigoDocumental}</div>
                                    </td>
                                    <td className="p-4 text-sm font-bold text-slate-700 dark:text-slate-300">
                                        {doc.proximaRevision ? format(new Date(doc.proximaRevision), "dd MMM, yyyy", { locale: es }) : 'N/A'}
                                    </td>
                                    <td className="p-4">
                                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded ${
                                            doc.indicadorVencimiento === 'vencido' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                                        }`}>
                                            {doc.indicadorVencimiento}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right">
                                        <button className="text-xs font-bold text-primary hover:underline">Revisar</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
