'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { History, Calendar, Filter, Download } from 'lucide-react';

export default function HistoricoTab({ user, isActive = true }: { user: any; isActive?: boolean }) {
    const [kpis, setKpis] = useState<any[]>([]);
    const [selectedKpiId, setSelectedKpiId] = useState('');
    const [mediciones, setMediciones] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchKpis = useCallback(async () => {
        try {
            const res = await fetch('/api/okr-kpi/kpi');
            if (res.ok) setKpis(await res.json());
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { 
        if (isActive) fetchKpis(); 
    }, [fetchKpis, isActive]);

    useEffect(() => {
        if (selectedKpiId) {
            fetchMediciones(selectedKpiId);
        } else {
            // Show all mediciones from all KPIs
            const all = kpis.flatMap((k: any) =>
                (k.historico || []).map((h: any) => ({ ...h, kpiCodigo: k.codigoKpi, kpiNombre: k.nombre, okrCodigo: k.okr?.codigoOkr || '' }))
            );
            all.sort((a, b) => new Date(b.fechaMedicion).getTime() - new Date(a.fechaMedicion).getTime());
            setMediciones(all);
        }
    }, [selectedKpiId, kpis]);

    const fetchMediciones = async (kpiId: string) => {
        try {
            const res = await fetch(`/api/okr-kpi/kpi/${kpiId}/medicion`);
            if (res.ok) {
                const data = await res.json();
                const kpi = kpis.find(k => k.id === kpiId);
                setMediciones(data.map((m: any) => ({ ...m, kpiCodigo: kpi?.codigoKpi || '', kpiNombre: kpi?.nombre || '', okrCodigo: kpi?.okr?.codigoOkr || '' })));
            }
        } catch (err) { console.error(err); }
    };

    if (loading) return <div className="flex items-center justify-center py-20"><div className="w-10 h-10 border-4 border-slate-200 border-t-slate-600 rounded-full animate-spin" /></div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Historial de Mediciones</h2>
                    <p className="text-sm text-slate-400">Trazabilidad completa de todas las mediciones — ISO 9001:2015</p>
                </div>
                <div className="flex items-center gap-2">
                    <select value={selectedKpiId} onChange={e => setSelectedKpiId(e.target.value)} className="h-9 px-3 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                        <option value="">Todos los KPIs</option>
                        {kpis.map((k: any) => <option key={k.id} value={k.id}>{k.codigoKpi} — {k.nombre}</option>)}
                    </select>
                </div>
            </div>

            {mediciones.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-12 text-center">
                    <History className="w-12 h-12 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
                    <h3 className="text-lg font-bold text-slate-600 dark:text-slate-300 mb-1">Sin mediciones registradas</h3>
                    <p className="text-sm text-slate-400">Las mediciones aparecerán acá una vez registradas</p>
                </div>
            ) : (
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                                    <th className="text-left px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider">Fecha</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider">OKR</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider">KPI</th>
                                    <th className="text-right px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider">Valor</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider">Comentario</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider">Registrado por</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                {mediciones.map((m: any) => (
                                    <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                            <div className="flex items-center gap-1.5">
                                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                                {new Date(m.fechaMedicion).toLocaleDateString('es-AR')}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded">{m.okrCodigo}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div>
                                                <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded">{m.kpiCodigo}</span>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-[200px]">{m.kpiNombre}</p>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right font-bold text-slate-800 dark:text-slate-100">{m.valorObtenido}</td>
                                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400 truncate max-w-[200px]">{m.comentario || '—'}</td>
                                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">{m.usuarioRegistroNombre || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30 text-xs text-slate-400">
                        {mediciones.length} mediciones registradas • Los registros históricos no pueden ser eliminados (ISO 9001)
                    </div>
                </div>
            )}
        </div>
    );
}
