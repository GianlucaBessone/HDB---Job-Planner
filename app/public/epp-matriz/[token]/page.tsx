'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { 
    ShieldCheck, 
    Building2, 
    Users, 
    Calendar, 
    Clock, 
    AlertTriangle, 
    CheckCircle2, 
    XCircle, 
    Search, 
    Printer, 
    RefreshCw, 
    Fingerprint, 
    FileText, 
    X,
    Loader2,
    Lock
} from 'lucide-react';
import { getPublicEppMatrixData } from '@/app/rrhh/personal/epp/actions';

export default function PublicEppMatrixPage() {
    const params = useParams();
    const token = params?.token as string;

    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'AL_DIA' | 'CON_VENCIDOS' | 'POR_VENCER'>('ALL');

    // Drawer / Modal de detalle de operario
    const [selectedRow, setSelectedRow] = useState<any | null>(null);

    const loadData = async () => {
        if (!token) return;
        setLoading(true);
        setError(null);
        try {
            const res = await getPublicEppMatrixData(token);
            if (res.success && res.data) {
                setData(res.data);
            } else {
                setError(res.error || 'No se pudo cargar la matriz de EPP');
            }
        } catch (e: any) {
            setError(e.message || 'Error de conexión con el servidor');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [token]);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
                <Loader2 className="w-10 h-10 animate-spin text-emerald-600 mb-4" />
                <h2 className="text-base font-bold text-slate-800 dark:text-slate-200">
                    Cargando Matriz de EPP en tiempo real...
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                    Verificando vigencias y registros de auditoría de personal
                </p>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center shadow-xl space-y-4">
                    <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center">
                        <Lock className="w-7 h-7" />
                    </div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
                        Enlace No Disponible
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                        {error || 'El enlace que intentas consultar no existe o ha sido revocado por el administrador.'}
                    </p>
                </div>
            </div>
        );
    }

    const { share, rows, eppGlobales, stats, updatedAt } = data;

    const filteredRows = rows.filter((r: any) => {
        const matchesSearch = 
            r.operator.nombreCompleto.toLowerCase().includes(search.toLowerCase()) ||
            (r.operator.dni && r.operator.dni.includes(search)) ||
            (r.operator.posicion && r.operator.posicion.toLowerCase().includes(search.toLowerCase()));

        if (!matchesSearch) return false;

        if (statusFilter === 'AL_DIA') return r.generalStatus === 'AL_DIA';
        if (statusFilter === 'CON_VENCIDOS') return r.generalStatus === 'CON_VENCIDOS';
        if (statusFilter === 'POR_VENCER') return r.generalStatus === 'POR_VENCER';

        return true;
    });

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 p-3 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header Público Corporativo */}
                <header className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-7 shadow-xs">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                                <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                                    <ShieldCheck className="w-3.5 h-3.5" />
                                    Higiene y Seguridad · ISO 45001
                                </span>

                                {share.tipo === 'CLIENTE' ? (
                                    <span className="px-3 py-1 bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                                        <Building2 className="w-3.5 h-3.5" />
                                        Cliente: {share.clientNombre}
                                    </span>
                                ) : (
                                    <span className="px-3 py-1 bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                                        <Users className="w-3.5 h-3.5" />
                                        Dotación General
                                    </span>
                                )}
                            </div>

                            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">
                                {share.titulo}
                            </h1>

                            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl">
                                {share.tipo === 'CLIENTE' ? (
                                    <>
                                        Personal operativo activo con registro de horas en proyectos de <strong>{share.clientNombre}</strong> durante los últimos 3 meses, junto con el estado de entrega y vigencia de sus Elementos de Protección Personal.
                                    </>
                                ) : (
                                    <>
                                        Control de entregas y vencimientos de Elementos de Protección Personal obligatorios para toda la dotación operativa activa de la empresa.
                                    </>
                                )}
                            </p>
                        </div>

                        {/* Botones de acción e info de timestamp */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                            <div className="text-[11px] text-slate-400 sm:text-right hidden sm:block">
                                <div>Actualizado en tiempo real</div>
                                <div className="font-mono text-slate-500">
                                    {new Date(updatedAt).toLocaleTimeString()}
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={loadData}
                                    title="Actualizar datos"
                                    className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl text-slate-700 dark:text-slate-300 transition-all"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                </button>

                                <button
                                    onClick={() => window.print()}
                                    className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2"
                                >
                                    <Printer className="w-4 h-4" />
                                    <span>Imprimir / PDF</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Métricas de Cobertura */}
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                    <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                            Cobertura del Grupo
                        </span>
                        <div className="flex items-baseline gap-2 mt-1">
                            <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                                {stats.porcentajeCobertura}%
                            </h3>
                            <span className="text-xs text-slate-400">al día</span>
                        </div>
                    </div>

                    <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                            Operadores Filtrados
                        </span>
                        <div className="flex items-baseline gap-2 mt-1">
                            <h3 className="text-2xl font-black text-slate-800 dark:text-slate-200">
                                {stats.totalOperadores}
                            </h3>
                            <span className="text-xs text-slate-400">activos</span>
                        </div>
                    </div>

                    <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 block">
                            EPP Vigentes
                        </span>
                        <h3 className="text-2xl font-black text-emerald-600 mt-1">
                            {stats.vigentesCount}
                        </h3>
                    </div>

                    <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 block">
                            Por Vencer (≤30d)
                        </span>
                        <h3 className="text-2xl font-black text-amber-600 mt-1">
                            {stats.porVencerCount}
                        </h3>
                    </div>

                    <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 block">
                            Vencidos
                        </span>
                        <h3 className="text-2xl font-black text-rose-600 mt-1">
                            {stats.vencidosCount}
                        </h3>
                    </div>
                </div>

                {/* Barra de Filtros y Búsqueda */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <div className="relative w-full sm:w-80">
                        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar por operador o DNI..."
                            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100"
                        />
                    </div>

                    {/* Filtros de estado */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs font-bold">
                        <button
                            onClick={() => setStatusFilter('ALL')}
                            className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                                statusFilter === 'ALL'
                                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                            }`}
                        >
                            Todos ({rows.length})
                        </button>
                        <button
                            onClick={() => setStatusFilter('AL_DIA')}
                            className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                                statusFilter === 'AL_DIA'
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                            }`}
                        >
                            Al Día
                        </button>
                        <button
                            onClick={() => setStatusFilter('CON_VENCIDOS')}
                            className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                                statusFilter === 'CON_VENCIDOS'
                                    ? 'bg-rose-600 text-white'
                                    : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                            }`}
                        >
                            Con Vencidos
                        </button>
                    </div>
                </div>

                {/* TABLA MATRIZ DE CONTROL */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xs">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 text-xs font-black uppercase tracking-wider">
                                    <th className="p-4 sticky left-0 bg-slate-50 dark:bg-slate-950 z-10 min-w-[220px]">
                                        Operador
                                    </th>
                                    {eppGlobales.map((epp: any) => (
                                        <th key={epp.id} className="p-3 text-center min-w-[130px]">
                                            <div className="font-black text-slate-800 dark:text-slate-200">
                                                {epp.nombre}
                                            </div>
                                            <span className="text-[10px] text-slate-400 font-normal">
                                                Validez: {epp.diasValidez}d
                                            </span>
                                        </th>
                                    ))}
                                    <th className="p-4 text-center min-w-[110px]">
                                        Historial
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                                {filteredRows.length === 0 ? (
                                    <tr>
                                        <td colSpan={eppGlobales.length + 2} className="p-12 text-center text-slate-400 font-medium">
                                            No se encontraron operadores para los criterios seleccionados
                                        </td>
                                    </tr>
                                ) : (
                                    filteredRows.map((row: any) => {
                                        const op = row.operator;

                                        return (
                                            <tr 
                                                key={op.id}
                                                className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                                            >
                                                {/* Columna Operador */}
                                                <td className="p-4 sticky left-0 bg-white dark:bg-slate-900 z-10">
                                                    <div>
                                                        <span className="font-bold text-slate-900 dark:text-slate-100 block text-xs">
                                                            {op.nombreCompleto}
                                                        </span>
                                                        <span className="text-[11px] text-slate-400 block">
                                                            DNI: {op.dni || 'S/D'} · {op.posicion || 'Operario'}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Celdas de EPP Globales */}
                                                {row.cells.map((cell: any) => {
                                                    const isVigente = cell.estado === 'VIGENTE';
                                                    const isPorVencer = cell.estado === 'POR_VENCER';
                                                    const isVencido = cell.estado === 'VENCIDO';
                                                    const isPendiente = cell.estado === 'PENDIENTE_FIRMA';
                                                    const isSinEntrega = cell.estado === 'SIN_ENTREGA';

                                                    return (
                                                        <td key={cell.eppItemId} className="p-2 text-center">
                                                            {isVigente && (
                                                                <div className="inline-flex flex-col items-center justify-center p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 w-full">
                                                                    <div className="flex items-center gap-1 font-black text-xs">
                                                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                                                        <span>Vigente</span>
                                                                    </div>
                                                                    <span className="text-[10px] text-emerald-600/80 font-mono mt-0.5">
                                                                        {cell.diasRestantes}d restantes
                                                                    </span>
                                                                </div>
                                                            )}

                                                            {isPorVencer && (
                                                                <div className="inline-flex flex-col items-center justify-center p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 w-full">
                                                                    <div className="flex items-center gap-1 font-black text-xs">
                                                                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                                                        <span>Por Vencer</span>
                                                                    </div>
                                                                    <span className="text-[10px] text-amber-700 font-mono mt-0.5">
                                                                        {cell.diasRestantes}d restantes
                                                                    </span>
                                                                </div>
                                                            )}

                                                            {isVencido && (
                                                                <div className="inline-flex flex-col items-center justify-center p-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800 w-full">
                                                                    <div className="flex items-center gap-1 font-black text-xs">
                                                                        <XCircle className="w-3.5 h-3.5 text-rose-600" />
                                                                        <span>Vencido</span>
                                                                    </div>
                                                                    <span className="text-[10px] text-rose-600/90 font-mono mt-0.5">
                                                                        hace {Math.abs(cell.diasRestantes)}d
                                                                    </span>
                                                                </div>
                                                            )}

                                                            {isPendiente && (
                                                                <div className="inline-flex flex-col items-center justify-center p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 w-full">
                                                                    <div className="flex items-center gap-1 font-bold text-[11px]">
                                                                        <Clock className="w-3.5 h-3.5 text-indigo-600" />
                                                                        <span>Pte. Firma</span>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {isSinEntrega && (
                                                                <div className="inline-flex items-center justify-center p-2 rounded-xl bg-slate-100/70 dark:bg-slate-800/40 text-slate-400 w-full">
                                                                    <span className="text-[11px] font-bold">Sin Entrega</span>
                                                                </div>
                                                            )}
                                                        </td>
                                                    );
                                                })}

                                                {/* Columna Acciones / Historial */}
                                                <td className="p-4 text-center">
                                                    <button
                                                        onClick={() => setSelectedRow(row)}
                                                        className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white rounded-xl font-bold text-xs text-slate-700 dark:text-slate-300 transition-all flex items-center justify-center gap-1.5 mx-auto"
                                                    >
                                                        <FileText className="w-3.5 h-3.5" />
                                                        <span>Ver Legajo</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Footer Público */}
                <footer className="text-center text-xs text-slate-400 py-4 space-y-1">
                    <p>
                        Sistema de Gestión Integrado · HDB Servicios Eléctricos SRL
                    </p>
                    <p className="text-[10px] text-slate-500 font-mono">
                        Documento auditado digitalmente bajo estándares de trazabilidad criptográfica
                    </p>
                </footer>
            </div>

            {/* MODAL / DRAWER DE HISTORIAL Y LEGAJO DEL OPERARIO */}
            {selectedRow && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in overflow-y-auto">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl my-8">
                        <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/75 dark:bg-slate-950/40">
                            <div>
                                <h3 className="font-black text-slate-900 dark:text-slate-100 text-base">
                                    Historial de Entregas de EPP
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                    {selectedRow.operator.nombreCompleto} · DNI: {selectedRow.operator.dni || 'S/D'} · {selectedRow.operator.posicion || 'Operador'}
                                </p>
                            </div>

                            <button 
                                onClick={() => setSelectedRow(null)}
                                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-5 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
                            {selectedRow.historialDeliveries?.length === 0 ? (
                                <div className="py-12 text-center text-slate-400 space-y-2">
                                    <FileText className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700" />
                                    <p className="font-medium">
                                        No hay actas de entrega registradas para este operario.
                                    </p>
                                </div>
                            ) : (
                                selectedRow.historialDeliveries.map((del: any) => {
                                    const isFirmada = del.estado === 'FIRMADA';

                                    return (
                                        <div 
                                            key={del.id}
                                            className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3"
                                        >
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 dark:border-slate-700/80 pb-3">
                                                <div>
                                                    <span className="font-black text-xs text-slate-900 dark:text-slate-100 block">
                                                        Acta {del.codigoActa}
                                                    </span>
                                                    <span className="text-[11px] text-slate-500">
                                                        Fecha: {new Date(del.fechaEntrega).toLocaleDateString()} · Despachó: {del.entregadoPor || 'Supervisor'}
                                                    </span>
                                                </div>

                                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase w-fit ${
                                                    isFirmada
                                                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                                                        : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                                                }`}>
                                                    {isFirmada ? 'Firmada Digitalmente' : 'Pendiente de Firma'}
                                                </span>
                                            </div>

                                            {/* Items del acta */}
                                            <div className="space-y-1.5">
                                                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block">
                                                    Elementos Entregados:
                                                </span>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    {del.items?.map((item: any) => (
                                                        <div 
                                                            key={item.id}
                                                            className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between"
                                                        >
                                                            <div>
                                                                <span className="font-bold text-slate-800 dark:text-slate-200 block text-[11px]">
                                                                    {item.cantidad}x {item.eppItem?.nombre}
                                                                </span>
                                                                <span className="text-[10px] text-slate-400">
                                                                    {item.talle ? `Talle: ${item.talle} · ` : ''}Validez: {item.diasValidez}d
                                                                </span>
                                                            </div>

                                                            <div className="text-right text-[10px]">
                                                                <span className="text-slate-400 block">Vence:</span>
                                                                <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                                                                    {new Date(item.fechaVencimiento).toLocaleDateString()}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Firma Digital y Checksum */}
                                            {isFirmada && del.signatureHash && (
                                                <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800/60 text-[11px] space-y-1">
                                                    <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 font-bold">
                                                        <Fingerprint className="w-3.5 h-3.5 text-emerald-600" />
                                                        <span>Firma Digital Válida</span>
                                                        {del.signatureId && <span className="font-mono text-[10px]">({del.signatureId})</span>}
                                                    </div>
                                                    <div className="text-[10px] text-slate-500 font-mono break-all">
                                                        Checksum SHA-256: {del.signatureHash}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex justify-end">
                            <button
                                onClick={() => setSelectedRow(null)}
                                className="px-5 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-700 dark:text-slate-300 rounded-xl font-bold"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
