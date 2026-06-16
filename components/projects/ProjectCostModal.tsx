'use client';

import { useState, useEffect } from 'react';
import { X, Clock, Package, Activity, DollarSign, Building2, Calculator, AlertTriangle } from 'lucide-react';
import { safeApiRequest } from '@/lib/offline';

interface CostData {
    project: {
        id: string;
        nombre: string;
        codigoProyecto: string | null;
    };
    operators: {
        name: string;
        hours: number;
        cost: number;
    }[];
    materials: {
        id: string;
        name: string;
        codigo: string | null;
        unidad: string;
        cantidad: number;
        precioUnitario: number;
        costo: number;
    }[];
    summary: {
        totalHours: number;
        valorManoObra: number;
        totalHoursCost: number;
        totalMaterialsCost: number;
        totalCost: number;
    };
    hasPendingReturns?: boolean;
}

export default function ProjectCostModal({
    projectId,
    onClose
}: {
    projectId: string;
    onClose: () => void;
}) {
    const [data, setData] = useState<CostData | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchCost = async () => {
        setLoading(true);
        try {
            const res = await safeApiRequest(`/api/projects/${projectId}/cost`);
            if (res.ok) {
                setData(await res.json());
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCost();
    }, [projectId]);

    const handleUpdatePrice = async (codigo: string | null, id: string, name: string, newPrice: number) => {
        try {
            const res = await safeApiRequest(`/api/projects/${projectId}/cost/materials`, {
                method: 'PATCH',
                body: JSON.stringify({ codigo, id, nombre: name, precioUnitario: newPrice })
            });
            if (res.ok) {
                await fetchCost();
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleSyncPrices = async () => {
        try {
            const res = await safeApiRequest(`/api/projects/${projectId}/cost/sync-prices`, { method: 'POST' });
            if (res.ok) {
                await fetchCost();
            }
        } catch (e) {
            console.error(e);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS',
        }).format(amount);
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-end md:items-center justify-center p-0 md:p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-800 w-full max-w-4xl rounded-t-3xl md:rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-700 animate-in slide-in-from-bottom-4 md:zoom-in-95 duration-300 max-h-[90vh] overflow-hidden flex flex-col">
                
                {/* Header */}
                <div className="p-6 md:p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            <div className="bg-amber-500 p-2 rounded-xl shadow-lg shadow-amber-200 dark:shadow-none">
                                <DollarSign className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-2">
                                    Costo de Proyecto
                                </h3>
                                {data?.project && (
                                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">
                                        {data.project.codigoProyecto ? (
                                            <span className="text-primary font-mono mr-1">{data.project.codigoProyecto} |</span>
                                        ) : ''}
                                        {data.project.nombre}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="btn-icon-inline p-3 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-400 dark:text-slate-500 transition-all active:scale-95">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 bg-slate-50/50 dark:bg-slate-900/20">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 space-y-4">
                            <Activity className="w-12 h-12 text-primary animate-spin" />
                            <p className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest text-xs">Calculando costos...</p>
                        </div>
                    ) : data ? (
                        <div className="space-y-6">
                            
                            {/* Resumen Total */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-5 rounded-3xl shadow-sm">
                                    <div className="flex items-center gap-2 text-indigo-500 mb-2">
                                        <Clock className="w-4 h-4" />
                                        <h4 className="text-xs font-black uppercase tracking-widest">Mano de Obra</h4>
                                    </div>
                                    <p className="text-2xl font-black text-slate-800 dark:text-slate-100">{formatCurrency(data.summary.totalHoursCost)}</p>
                                    <p className="text-xs font-bold text-slate-400 mt-1">{data.summary.totalHours} horas x {formatCurrency(data.summary.valorManoObra)}/h</p>
                                </div>
                                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-5 rounded-3xl shadow-sm">
                                    <div className="flex items-center gap-2 text-amber-500 mb-2">
                                        <Package className="w-4 h-4" />
                                        <h4 className="text-xs font-black uppercase tracking-widest">Materiales</h4>
                                    </div>
                                    <p className="text-2xl font-black text-slate-800 dark:text-slate-100">{formatCurrency(data.summary.totalMaterialsCost)}</p>
                                    <p className="text-xs font-bold text-slate-400 mt-1">{data.materials.length} materiales utilizados</p>
                                </div>
                                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-5 rounded-3xl shadow-sm">
                                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-2">
                                        <Calculator className="w-4 h-4" />
                                        <h4 className="text-xs font-black uppercase tracking-widest">Costo Total</h4>
                                    </div>
                                    <p className="text-3xl font-black text-emerald-700 dark:text-emerald-400">{formatCurrency(data.summary.totalCost)}</p>
                                    <p className="text-xs font-bold text-emerald-600/70 dark:text-emerald-500 mt-1">Costo final del proyecto</p>
                                </div>
                            </div>

                            {/* Horas del Proyecto */}
                            <section className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                                <div className="px-6 py-4 border-b border-slate-50 dark:border-slate-700 flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-indigo-500" />
                                    <h2 className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-wide">Desglose de Mano de Obra</h2>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
                                                <th className="px-6 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Operador</th>
                                                <th className="px-6 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Horas</th>
                                                <th className="px-6 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Costo</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                                            {data.operators.length === 0 ? (
                                                <tr>
                                                    <td colSpan={3} className="px-6 py-8 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">Sin horas registradas</td>
                                                </tr>
                                            ) : data.operators.map((op, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                    <td className="px-6 py-3">
                                                        <div className="font-bold text-slate-700 dark:text-slate-200 text-sm">{op.name}</div>
                                                    </td>
                                                    <td className="px-6 py-3 text-right">
                                                        <span className="font-black text-slate-600 dark:text-slate-300">{op.hours}h</span>
                                                    </td>
                                                    <td className="px-6 py-3 text-right">
                                                        <span className="font-bold text-indigo-600 dark:text-indigo-400">{formatCurrency(op.cost)}</span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </section>

                            {/* Materiales */}
                            <section className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                                <div className="px-6 py-4 border-b border-slate-50 dark:border-slate-700 flex items-center justify-between">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <Package className="w-4 h-4 text-amber-500" />
                                        <h2 className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-wide">Materiales Utilizados</h2>
                                        {data?.hasPendingReturns && (
                                            <span className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-black animate-pulse border border-rose-100 dark:border-rose-900/50">
                                                <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                                                <span>Devoluciones Pendientes</span>
                                            </span>
                                        )}
                                    </div>
                                    <button 
                                        onClick={handleSyncPrices}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-xs font-bold text-slate-600 dark:text-slate-300 rounded-lg transition-colors"
                                    >
                                        <Activity className="w-3.5 h-3.5" />
                                        Actualizar Precios
                                    </button>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
                                                <th className="px-6 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Código</th>
                                                <th className="px-6 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Material</th>
                                                <th className="px-6 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Cant.</th>
                                                <th className="px-6 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">P. Unitario</th>
                                                <th className="px-6 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Subtotal</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                                            {data.materials.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="px-6 py-8 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">Sin materiales utilizados</td>
                                                </tr>
                                            ) : data.materials.map(m => (
                                                <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                    <td className="px-6 py-3">
                                                        <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{m.codigo || '-'}</span>
                                                    </td>
                                                    <td className="px-6 py-3">
                                                        <div className="font-bold text-slate-700 dark:text-slate-200 text-sm">{m.name}</div>
                                                    </td>
                                                    <td className="px-6 py-3 text-right">
                                                        <span className="font-black text-slate-600 dark:text-slate-300">{m.cantidad} {m.unidad}</span>
                                                    </td>
                                                    <td className="px-6 py-3 text-right">
                                                        <EditablePriceCell 
                                                            value={m.precioUnitario} 
                                                            onSave={(val) => handleUpdatePrice(m.codigo, m.id, m.name, val)} 
                                                            formatCurrency={formatCurrency}
                                                        />
                                                    </td>
                                                    <td className="px-6 py-3 text-right">
                                                        <span className="font-bold text-amber-600 dark:text-amber-500">{formatCurrency(m.costo)}</span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </section>

                        </div>
                    ) : (
                        <div className="text-center text-slate-500 py-10">Error al cargar datos</div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800 shrink-0">
                    <button
                        onClick={onClose}
                        className="w-full py-4 bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-2xl font-black text-base transition-all flex items-center justify-center gap-2"
                    >
                        Cerrar
                    </button>
                </div>

            </div>
        </div>
    );
}

function EditablePriceCell({ value, onSave, formatCurrency }: { value: number, onSave: (v: number) => void, formatCurrency: (v: number) => string }) {
    const [isEditing, setIsEditing] = useState(false);
    const [val, setVal] = useState(value.toString());

    useEffect(() => { setVal(value.toString()); }, [value]);

    const handleBlur = () => {
        setIsEditing(false);
        const parsed = parseFloat(val);
        if (!isNaN(parsed) && parsed >= 0 && parsed !== value) {
            onSave(parsed);
        } else {
            setVal(value.toString());
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleBlur();
        if (e.key === 'Escape') {
            setVal(value.toString());
            setIsEditing(false);
        }
    };

    if (isEditing) {
        return (
            <input 
                autoFocus
                type="number" 
                min={0}
                step="any"
                value={val} 
                onChange={e => setVal(e.target.value)} 
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                className="w-24 bg-white dark:bg-slate-900 border border-primary/50 shadow-sm rounded px-1.5 py-1 outline-none focus:ring-2 focus:ring-primary/20 text-right text-sm font-medium"
            />
        );
    }

    return (
        <span 
            onClick={() => setIsEditing(true)} 
            className="text-sm font-medium text-slate-500 dark:text-slate-400 cursor-text hover:bg-slate-100 dark:hover:bg-slate-700/50 px-2 py-1 rounded transition-colors"
            title="Click para editar"
        >
            {formatCurrency(value)}
        </span>
    );
}
