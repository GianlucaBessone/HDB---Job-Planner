'use client';

import React, { useState } from 'react';
import { 
    Search, 
    Filter, 
    CheckCircle2, 
    AlertTriangle, 
    Clock, 
    ShieldAlert, 
    User, 
    ChevronRight,
    Plus,
    Calendar,
    HelpCircle
} from 'lucide-react';

interface EppMatrixTableProps {
    operadores: any[];
    eppGlobales: any[];
    matriz: Record<string, Record<string, any>>;
    onSelectOperator: (operatorId: string) => void;
    onStartDelivery: (operatorId: string) => void;
}

export default function EppMatrixTable({
    operadores,
    eppGlobales,
    matriz,
    onSelectOperator,
    onStartDelivery
}: EppMatrixTableProps) {
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState<'ALL' | 'VENCIDOS' | 'PENDIENTES' | 'AL_DIA'>('ALL');

    // Filtrar operadores
    const filteredOperators = operadores.filter(op => {
        const matchesSearch = 
            op.nombreCompleto.toLowerCase().includes(search.toLowerCase()) ||
            (op.dni && op.dni.includes(search));

        if (!matchesSearch) return false;

        const opMatrix = matriz[op.id] || {};
        const cells = Object.values(opMatrix);

        if (filterStatus === 'VENCIDOS') {
            return cells.some(c => c.estado === 'VENCIDO');
        }
        if (filterStatus === 'PENDIENTES') {
            return cells.some(c => c.estado === 'SIN_ENTREGA' || c.estado === 'PENDIENTE_FIRMA');
        }
        if (filterStatus === 'AL_DIA') {
            return cells.length > 0 && cells.every(c => c.estado === 'VIGENTE');
        }

        return true;
    });

    const renderCellBadge = (cell: any, opId: string) => {
        if (!cell || cell.estado === 'SIN_ENTREGA') {
            return (
                <div 
                    title="Sin entrega registrada"
                    className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                    <span className="text-xs font-bold">-</span>
                </div>
            );
        }

        if (cell.estado === 'PENDIENTE_FIRMA') {
            return (
                <div 
                    title={`Entrega despachada: ${cell.codigoActa}. Pendiente de firma por el operario`}
                    className="inline-flex items-center justify-center px-2 py-1 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-[11px] font-bold border border-amber-300 dark:border-amber-800"
                >
                    <Clock className="w-3 h-3 mr-1 animate-pulse" />
                    Pte.
                </div>
            );
        }

        if (cell.estado === 'VENCIDO') {
            return (
                <div 
                    title={`Vencido hace ${Math.abs(cell.diasRestantes)} días (Vto: ${new Date(cell.fechaVencimiento).toLocaleDateString()})`}
                    className="inline-flex items-center justify-center px-2 py-1 rounded-xl bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 text-[11px] font-black border border-rose-300 dark:border-rose-800 shadow-xs"
                >
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Vencido
                </div>
            );
        }

        if (cell.estado === 'POR_VENCER') {
            return (
                <div 
                    title={`Próximo a vencer en ${cell.diasRestantes} días (Vto: ${new Date(cell.fechaVencimiento).toLocaleDateString()})`}
                    className="inline-flex items-center justify-center px-2 py-1 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[11px] font-bold border border-amber-300 dark:border-amber-700"
                >
                    <Clock className="w-3 h-3 mr-1" />
                    {cell.diasRestantes}d
                </div>
            );
        }

        // VIGENTE
        return (
            <div 
                title={`Vigente hasta ${new Date(cell.fechaVencimiento).toLocaleDateString()} (${cell.diasRestantes} días restantes)`}
                className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 shadow-xs"
            >
                <CheckCircle2 className="w-4 h-4" />
            </div>
        );
    };

    return (
        <div className="space-y-4">
            {/* Barra de Filtros y Búsqueda */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
                <div className="relative w-full sm:w-80">
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Buscar por operador o DNI..."
                        className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                </div>

                <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                    <button
                        onClick={() => setFilterStatus('ALL')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                            filterStatus === 'ALL'
                                ? 'bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                        }`}
                    >
                        Todos ({operadores.length})
                    </button>

                    <button
                        onClick={() => setFilterStatus('VENCIDOS')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                            filterStatus === 'VENCIDOS'
                                ? 'bg-rose-600 text-white'
                                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100'
                        }`}
                    >
                        Con Vencidos
                    </button>

                    <button
                        onClick={() => setFilterStatus('PENDIENTES')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                            filterStatus === 'PENDIENTES'
                                ? 'bg-amber-600 text-white'
                                : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 hover:bg-amber-100'
                        }`}
                    >
                        Con Faltantes
                    </button>

                    <button
                        onClick={() => setFilterStatus('AL_DIA')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                            filterStatus === 'AL_DIA'
                                ? 'bg-emerald-600 text-white'
                                : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100'
                        }`}
                    >
                        100% Al Día
                    </button>
                </div>
            </div>

            {/* Matriz interactiva */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
                {eppGlobales.length === 0 ? (
                    <div className="p-12 text-center text-slate-400">
                        <ShieldAlert className="w-12 h-12 mx-auto mb-3 opacity-40 text-amber-500" />
                        <h4 className="font-bold text-slate-700 dark:text-slate-300 text-base">
                            No hay Elementos de EPP Globales creados
                        </h4>
                        <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                            Diríjase a la pestaña de "Catálogo & Stock" para dar de alta los EPP obligatorios (Casco, Calzado, etc.) marcándolos como globales.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-950/50">
                                    <th className="p-4 text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 sticky left-0 bg-slate-50 dark:bg-slate-950 z-10 w-72 shadow-[1px_0_0_0_rgba(0,0,0,0.05)] dark:shadow-[1px_0_0_0_rgba(255,255,255,0.05)]">
                                        Operador ({filteredOperators.length})
                                    </th>

                                    {eppGlobales.map(epp => (
                                        <th key={epp.id} className="p-4 text-center min-w-[130px]">
                                            <div className="flex flex-col items-center">
                                                <span className="text-xs font-black text-slate-800 dark:text-slate-200 line-clamp-1" title={epp.nombre}>
                                                    {epp.nombre}
                                                </span>
                                                <span className="text-[10px] text-slate-400 font-medium mt-0.5">
                                                    Validez: {epp.diasValidez}d
                                                </span>
                                            </div>
                                        </th>
                                    ))}

                                    <th className="p-4 text-center text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 w-28">
                                        Acción
                                    </th>
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                                {filteredOperators.length === 0 ? (
                                    <tr>
                                        <td colSpan={eppGlobales.length + 2} className="p-8 text-center text-slate-400 text-xs font-medium">
                                            No se encontraron operadores con los filtros seleccionados
                                        </td>
                                    </tr>
                                ) : (
                                    filteredOperators.map(op => {
                                        const opMatrix = matriz[op.id] || {};

                                        return (
                                            <tr 
                                                key={op.id}
                                                className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group"
                                            >
                                                {/* Columna Operador */}
                                                <td 
                                                    onClick={() => onSelectOperator(op.id)}
                                                    className="p-4 sticky left-0 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-850 z-10 cursor-pointer shadow-[1px_0_0_0_rgba(0,0,0,0.05)] dark:shadow-[1px_0_0_0_rgba(255,255,255,0.05)]"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black text-xs">
                                                            {op.nombreCompleto?.slice(0, 2).toUpperCase() || <User className="w-4 h-4" />}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block truncate hover:text-emerald-600">
                                                                {op.nombreCompleto}
                                                            </span>
                                                            <span className="text-[11px] text-slate-400 block truncate">
                                                                DNI: {op.dni || 'S/D'} · {op.posicion || op.role}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Celdas EPP Globales */}
                                                {eppGlobales.map(epp => {
                                                    const cell = opMatrix[epp.id];
                                                    return (
                                                        <td 
                                                            key={epp.id} 
                                                            onClick={() => onSelectOperator(op.id)}
                                                            className="p-4 text-center cursor-pointer"
                                                        >
                                                            {renderCellBadge(cell, op.id)}
                                                        </td>
                                                    );
                                                })}

                                                {/* Botón Acción Rápida */}
                                                <td className="p-4 text-center">
                                                    <button
                                                        onClick={() => onStartDelivery(op.id)}
                                                        title="Registrar entrega a este operador"
                                                        className="px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600 hover:text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1 mx-auto"
                                                    >
                                                        <Plus className="w-3.5 h-3.5" />
                                                        Entregar
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Leyenda Semáforo */}
            <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-500 dark:text-slate-400 py-2">
                <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[10px]">
                        <CheckCircle2 className="w-3 h-3" />
                    </div>
                    <span>Vigente</span>
                </div>

                <div className="flex items-center gap-1.5">
                    <div className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[10px]">
                        15d
                    </div>
                    <span>Próximo a Vencer (&le; 30d)</span>
                </div>

                <div className="flex items-center gap-1.5">
                    <div className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 font-black text-[10px]">
                        Vencido
                    </div>
                    <span>Vencido</span>
                </div>

                <div className="flex items-center gap-1.5">
                    <div className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-bold text-[10px]">
                        Pte.
                    </div>
                    <span>Pendiente de Firma</span>
                </div>

                <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded bg-slate-100 text-slate-400 flex items-center justify-center font-bold text-[10px]">
                        -
                    </div>
                    <span>Sin Entrega</span>
                </div>
            </div>
        </div>
    );
}
