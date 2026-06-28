import React, { useState, useEffect } from 'react';
import { X, Play, AlertTriangle } from 'lucide-react';

export default function DatasetPreviewModal({ dataset, onClose }: any) {
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchPreview = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch(`/api/datasets/${dataset.id}/preview`, { method: 'POST' });
                const data = await res.json();
                if (res.ok) {
                    setPreviewData(data.datos || []);
                } else {
                    setError(data.error);
                }
            } catch (err: any) {
                setError(err.message || 'Error desconocido');
            } finally {
                setLoading(false);
            }
        };
        fetchPreview();
    }, [dataset.id]);

    const getColumns = () => {
        if (previewData.length === 0) return [];
        return Object.keys(previewData[0]);
    };

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <div className="bg-card text-card-foreground rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700 shrink-0">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            Previsualización: {dataset.nombre}
                        </h2>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-1">{dataset.consultaSQL}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl"><X className="w-5 h-5 text-slate-400" /></button>
                </div>
                
                <div className="flex-1 overflow-auto bg-background text-foreground">
                    {loading ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400">
                            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
                            <p className="text-sm">Ejecutando consulta (Límite: 50 registros)...</p>
                        </div>
                    ) : error ? (
                        <div className="p-8">
                            <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl p-4 flex gap-3 text-rose-700 dark:text-rose-400">
                                <AlertTriangle className="w-5 h-5 shrink-0" />
                                <div>
                                    <h3 className="font-bold mb-1">Error al ejecutar la consulta</h3>
                                    <p className="text-sm break-all font-mono whitespace-pre-wrap">{error}</p>
                                </div>
                            </div>
                        </div>
                    ) : previewData.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                            La consulta no devolvió ningún registro.
                        </div>
                    ) : (
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-muted text-muted-foreground sticky top-0 shadow-sm z-10">
                                <tr>
                                    <th className="px-4 py-2 font-bold text-slate-500 uppercase text-[10px] tracking-wider w-10 text-center border-b border-slate-200 dark:border-slate-700">#</th>
                                    {getColumns().map(col => (
                                        <th key={col} className="px-4 py-2 font-bold text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700">{col}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {previewData.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10">
                                        <td className="px-4 py-2 text-xs text-slate-400 text-center border-r border-slate-100 dark:border-slate-800">{idx + 1}</td>
                                        {getColumns().map(col => {
                                            const val = row[col];
                                            const isDate = val instanceof Date || (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}T/));
                                            return (
                                                <td key={col} className="px-4 py-2 text-xs text-slate-700 dark:text-slate-300">
                                                    {val === null ? <span className="text-slate-400 italic">null</span> :
                                                     isDate ? new Date(val).toLocaleString() :
                                                     typeof val === 'object' ? JSON.stringify(val) :
                                                     String(val)}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
