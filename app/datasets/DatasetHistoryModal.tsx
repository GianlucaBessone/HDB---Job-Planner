import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, XCircle, Clock } from 'lucide-react';

export default function DatasetHistoryModal({ dataset, onClose }: any) {
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const res = await fetch(`/api/datasets/${dataset.id}/historial`);
                if (res.ok) setHistory(await res.json());
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchHistory();
    }, [dataset.id]);

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <div className="bg-card text-card-foreground rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700 shrink-0">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Historial de Ejecución</h2>
                        <p className="text-sm text-slate-500 mt-0.5">{dataset.nombre}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl"><X className="w-5 h-5 text-slate-400" /></button>
                </div>
                
                <div className="flex-1 overflow-auto p-5">
                    {loading ? (
                        <div className="flex items-center justify-center py-10"><div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" /></div>
                    ) : history.length === 0 ? (
                        <div className="text-center text-slate-400 py-10 text-sm">No hay registros de ejecución para este dataset.</div>
                    ) : (
                        <div className="space-y-4">
                            {history.map((record: any) => (
                                <div key={record.id} className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-800/50 flex flex-col gap-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            {record.estado === 'Exito' ? (
                                                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                            ) : (
                                                <XCircle className="w-5 h-5 text-rose-500" />
                                            )}
                                            <span className="font-bold text-sm text-slate-700 dark:text-slate-200">
                                                {new Date(record.fechaEjecucion).toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-4 text-xs font-bold">
                                            <span className="text-slate-500 bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded-md flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {record.duracionMs} ms</span>
                                            <span className="text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/30 px-2 py-1 rounded-md">{record.cantidadRegistros} registros</span>
                                        </div>
                                    </div>
                                    
                                    {record.estado === 'Error' && record.mensajeError && (
                                        <div className="bg-rose-100 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 text-xs p-3 rounded-lg font-mono whitespace-pre-wrap">
                                            {record.mensajeError}
                                        </div>
                                    )}
                                    {record.estado === 'Exito' && (
                                        <div className="text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2 rounded-lg">
                                            <span className="font-bold">Ejecutado por:</span> {record.tipoTrigger}
                                            <div className="mt-1 line-clamp-1 font-mono text-[10px] text-slate-400" title={record.queryEjecutada}>{record.queryEjecutada}</div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
