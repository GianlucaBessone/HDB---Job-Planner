'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import VentasNavTabs from '@/components/ventas/VentasNavTabs';
import {
    Search, DollarSign, AlertTriangle, CheckCircle2, Clock,
    UserCheck, ShieldAlert, Printer, Settings2, FilePlus2, RefreshCw,
    Ban, Eye, Phone, Mail, TrendingUp, ArrowUp, ArrowDown, ArrowUpDown, X
} from 'lucide-react';
import { showToast } from '@/components/Toast';
import RegistrarCobranzaModal, { ComprobantePendienteItem } from '@/components/ventas/cuentas-corrientes/RegistrarCobranzaModal';
import RegistrarAjusteCCModal from '@/components/ventas/cuentas-corrientes/RegistrarAjusteCCModal';
import ConfigCreditoModal from '@/components/ventas/cuentas-corrientes/ConfigCreditoModal';
import ImprimirReciboCCModal from '@/components/ventas/cuentas-corrientes/ImprimirReciboCCModal';
import ImprimirEstadoCuentaModal from '@/components/ventas/cuentas-corrientes/ImprimirEstadoCuentaModal';
import ComprobanteModal from '@/components/ventas/pdv/ComprobanteModal';

type FiltroCartera = 'TODOS' | 'CON_DEUDA' | 'VENCIDOS' | 'EXCEDIDOS' | 'SUSPENDIDOS' | 'SALDO_FAVOR';
type OrdenCartera = 'MAYOR_DEUDA' | 'MAYOR_MORA' | 'NOMBRE_ASC';
type SubTabDetalle = 'PENDIENTES' | 'MAYOR' | 'RECIBOS';

interface ClienteCarteraItem {
    id: string;
    nombre: string;
    email: string | null;
    telefono: string | null;
    direccion: string | null;
    config: {
        limiteCredito: number;
        plazoDias: number;
        estadoCredito: string;
        observaciones: string | null;
    };
    totalDebe: number;
    totalHaber: number;
    saldoActual: number;
    deudaVencida: number;
    comprobantesPendientes: number;
    diasMoraMax: number;
    proximoVencimiento: string | null;
    ultimaOperacionAt: string | null;
    alertaCredito: 'SUSPENDIDO' | 'EXCEDIDO' | 'VENCIDO' | 'OBSERVADO' | 'AL_DIA';
    tieneActividad: boolean;
}

export default function CuentasCorrientesPage() {
    const [kpis, setKpis] = useState({
        deudaTotalActiva: 0,
        saldoAFavorTotal: 0,
        clientesConDeuda: 0,
        clientesConVencidos: 0,
        clientesExcedidosLimite: 0,
        cobranzasMesActual: 0,
        comprobantesPendientesTotal: 0,
    });
    const [clientes, setClientes] = useState<ClienteCarteraItem[]>([]);
    const [loadingCartera, setLoadingCartera] = useState(true);
    const [busqueda, setBusqueda] = useState('');
    const [filtro, setFiltro] = useState<FiltroCartera>('TODOS');
    const [ordenCartera, setOrdenCartera] = useState<OrdenCartera>('MAYOR_DEUDA');

    const [selectedClienteId, setSelectedClienteId] = useState<string | null>(null);
    const [detalleCliente, setDetalleCliente] = useState<{
        cliente: {
            id: string;
            nombre: string;
            email: string | null;
            telefono: string | null;
            direccion: string | null;
            config: {
                limiteCredito: number;
                plazoDias: number;
                estadoCredito: string;
                observaciones: string | null;
            };
        };
        resumen: {
            totalDebe: number;
            totalHaber: number;
            saldoActual: number;
            deudaVencida: number;
            deudaNoVencida: number;
            disponibleCredito: number | null;
            porcentajeUsoCredito: number;
            comprobantesPendientesCount: number;
            diasMoraMaxima: number;
        };
        comprobantesPendientes: ComprobantePendienteItem[];
        libroMayor: any[];
        libroMayorCronologico: any[];
        recibos: any[];
    } | null>(null);
    const [loadingDetalle, setLoadingDetalle] = useState(false);
    const [subTab, setSubTab] = useState<SubTabDetalle>('PENDIENTES');

    // Estado de ordenamiento para las 3 tablas de detalle
    const [pendientesSortBy, setPendientesSortBy] = useState<string>('fechaVencimiento');
    const [pendientesSortOrder, setPendientesSortOrder] = useState<'asc' | 'desc'>('asc');

    const [mayorSortBy, setMayorSortBy] = useState<string>('fecha');
    const [mayorSortOrder, setMayorSortOrder] = useState<'asc' | 'desc'>('desc');

    const [recibosSortBy, setRecibosSortBy] = useState<string>('fecha');
    const [recibosSortOrder, setRecibosSortOrder] = useState<'asc' | 'desc'>('desc');

    // Modales
    const [showCobranzaModal, setShowCobranzaModal] = useState(false);
    const [showAjusteModal, setShowAjusteModal] = useState(false);
    const [showConfigModal, setShowConfigModal] = useState(false);
    const [showEstadoCuentaModal, setShowEstadoCuentaModal] = useState(false);
    const [reciboImprimir, setReciboImprimir] = useState<any | null>(null);
    const [ventaVerModal, setVentaVerModal] = useState<any | null>(null);
    const [movimientoAnular, setMovimientoAnular] = useState<{
        id: string;
        numero: string;
        concepto: string;
        monto: number;
    } | null>(null);
    const [motivoAnulacion, setMotivoAnulacion] = useState('');
    const [supervisorPinAnulacion, setSupervisorPinAnulacion] = useState('');
    const [anulando, setAnulando] = useState(false);
    const [currentUser, setCurrentUser] = useState<any>(null);

    useEffect(() => {
        try {
            const raw = localStorage.getItem('currentUser');
            if (raw) {
                setCurrentUser(JSON.parse(raw));
            }
        } catch {
            // ignore
        }
    }, []);

    const esSupervisorOAdmin = ['admin', 'administrador', 'supervisor'].includes(
        (currentUser?.role || '').toLowerCase()
    );

    const fmt = (n: number) =>
        (n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const fmtDate = (iso: string | Date | null) => {
        if (!iso) return '—';
        try {
            return new Date(iso).toLocaleDateString('es-AR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
            });
        } catch {
            return String(iso);
        }
    };

    const cargarCartera = useCallback(async (keepSelected = true) => {
        setLoadingCartera(true);
        try {
            const res = await fetch('/api/ventas/cuentas-corrientes');
            const data = await res.json();
            if (res.ok) {
                setKpis(data.kpis);
                setClientes(data.clientes || []);
                if (!keepSelected || !selectedClienteId) {
                    const primerConDeuda = (data.clientes || []).find(
                        (c: ClienteCarteraItem) => c.saldoActual > 0.01
                    );
                    const inicial = primerConDeuda || (data.clientes || [])[0];
                    if (inicial) {
                        setSelectedClienteId(inicial.id);
                    }
                }
            }
        } catch (err) {
            console.error('Error cargando cuentas corrientes:', err);
        } finally {
            setLoadingCartera(false);
        }
    }, [selectedClienteId]);

    const cargarDetalleCliente = useCallback(async (clienteId: string) => {
        setLoadingDetalle(true);
        try {
            const res = await fetch(`/api/ventas/cuentas-corrientes/${clienteId}`);
            const data = await res.json();
            if (res.ok) {
                setDetalleCliente(data);
            }
        } catch (err) {
            console.error('Error cargando detalle de cliente CC:', err);
        } finally {
            setLoadingDetalle(false);
        }
    }, []);

    useEffect(() => {
        cargarCartera(false);
    }, []);

    useEffect(() => {
        if (selectedClienteId) {
            cargarDetalleCliente(selectedClienteId);
        } else {
            setDetalleCliente(null);
        }
    }, [selectedClienteId, cargarDetalleCliente]);

    const handleRefreshTodo = async () => {
        await cargarCartera(true);
        if (selectedClienteId) {
            await cargarDetalleCliente(selectedClienteId);
        }
    };

    const handleVerVenta = async (ventaId: string) => {
        try {
            const res = await fetch(`/api/ventas/comprobantes/${ventaId}`);
            if (res.ok) {
                const data = await res.json();
                setVentaVerModal(data);
            }
        } catch (err) {
            console.error('Error al cargar comprobante de venta:', err);
            showToast('Error al cargar comprobante de venta', 'error');
        }
    };

    const handleConfirmarAnulacion = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!movimientoAnular || !motivoAnulacion.trim()) return;
        setAnulando(true);
        try {
            const operadorNombre =
                currentUser?.nombreCompleto || currentUser?.name || currentUser?.nombre || '';
            const res = await fetch(
                `/api/ventas/cuentas-corrientes/movimientos/${movimientoAnular.id}/anular`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-user-id': currentUser?.id || '',
                        'x-user-name': operadorNombre,
                        'x-user-role': currentUser?.role || '',
                    },
                    body: JSON.stringify({
                        motivo: motivoAnulacion.trim(),
                        supervisorPin: supervisorPinAnulacion.trim() || undefined,
                    }),
                }
            );
            const data = await res.json();
            if (!res.ok) {
                showToast(data.error || 'No se pudo anular el movimiento', 'error');
                return;
            }
            showToast(`Movimiento ${movimientoAnular.numero} anulado correctamente`, 'success');
            setMovimientoAnular(null);
            setMotivoAnulacion('');
            setSupervisorPinAnulacion('');
            await handleRefreshTodo();
        } catch (err: any) {
            showToast(err.message || 'Error al anular movimiento', 'error');
        } finally {
            setAnulando(false);
        }
    };

    const clientesFiltrados = useMemo(() => {
        const filtrados = clientes.filter((c) => {
            if (filtro === 'CON_DEUDA' && c.saldoActual <= 0.01) return false;
            if (filtro === 'VENCIDOS' && c.deudaVencida <= 0.01) return false;
            if (filtro === 'EXCEDIDOS' && c.alertaCredito !== 'EXCEDIDO') return false;
            if (filtro === 'SUSPENDIDOS' && c.config.estadoCredito !== 'SUSPENDIDO') return false;
            if (filtro === 'SALDO_FAVOR' && c.saldoActual >= -0.01) return false;

            if (busqueda.trim()) {
                const words = busqueda.toLowerCase().trim().split(/\s+/).filter(Boolean);
                const haystack = `${c.nombre} ${c.email || ''} ${c.telefono || ''} ${c.direccion || ''}`.toLowerCase();
                if (!words.every((w) => haystack.includes(w))) return false;
            }
            return true;
        });

        return [...filtrados].sort((a, b) => {
            if (ordenCartera === 'MAYOR_MORA') {
                if (b.diasMoraMax !== a.diasMoraMax) return b.diasMoraMax - a.diasMoraMax;
                return b.deudaVencida - a.deudaVencida;
            }
            if (ordenCartera === 'NOMBRE_ASC') {
                return a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });
            }
            // Default: MAYOR_DEUDA
            if (Math.abs(b.saldoActual - a.saldoActual) > 0.01) {
                return b.saldoActual - a.saldoActual;
            }
            return a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });
        });
    }, [clientes, filtro, busqueda, ordenCartera]);

    const handlePendientesSort = (col: string) => {
        if (pendientesSortBy === col) {
            setPendientesSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
        } else {
            setPendientesSortBy(col);
            setPendientesSortOrder(['montoOriginalCC', 'montoPagadoCC', 'saldoPendiente'].includes(col) ? 'desc' : 'asc');
        }
    };

    const handleMayorSort = (col: string) => {
        if (mayorSortBy === col) {
            setMayorSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
        } else {
            setMayorSortBy(col);
            setMayorSortOrder(['fecha', 'debe', 'haber', 'saldoAcumulado'].includes(col) ? 'desc' : 'asc');
        }
    };

    const handleRecibosSort = (col: string) => {
        if (recibosSortBy === col) {
            setRecibosSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
        } else {
            setRecibosSortBy(col);
            setRecibosSortOrder(['fecha', 'importe'].includes(col) ? 'desc' : 'asc');
        }
    };

    const renderSortIcon = (activeCol: string, activeOrder: 'asc' | 'desc', col: string) => {
        if (activeCol !== col) return <ArrowUpDown className="w-3 h-3 opacity-30 shrink-0" />;
        return activeOrder === 'asc' ? (
            <ArrowUp className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
        ) : (
            <ArrowDown className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
        );
    };

    const comprobantesPendientesSorted = useMemo(() => {
        const list = detalleCliente?.comprobantesPendientes || [];
        const dir = pendientesSortOrder === 'asc' ? 1 : -1;
        return [...list].sort((a: any, b: any) => {
            switch (pendientesSortBy) {
                case 'numero':
                    return (a.numero || '').localeCompare(b.numero || '', 'es', { numeric: true }) * dir;
                case 'fecha':
                    return (new Date(a.fecha || 0).getTime() - new Date(b.fecha || 0).getTime()) * dir;
                case 'fechaVencimiento':
                    return (new Date(a.fechaVencimiento || 0).getTime() - new Date(b.fechaVencimiento || 0).getTime()) * dir;
                case 'concepto':
                    return (a.concepto || '').localeCompare(b.concepto || '', 'es', { sensitivity: 'base' }) * dir;
                case 'montoOriginalCC':
                    return ((a.montoOriginalCC || 0) - (b.montoOriginalCC || 0)) * dir;
                case 'montoPagadoCC':
                    return ((a.montoPagadoCC || 0) - (b.montoPagadoCC || 0)) * dir;
                case 'saldoPendiente':
                    return ((a.saldoPendiente || 0) - (b.saldoPendiente || 0)) * dir;
                default:
                    return 0;
            }
        });
    }, [detalleCliente?.comprobantesPendientes, pendientesSortBy, pendientesSortOrder]);

    const libroMayorSorted = useMemo(() => {
        const list = detalleCliente?.libroMayor || [];
        const dir = mayorSortOrder === 'asc' ? 1 : -1;
        return [...list].sort((a: any, b: any) => {
            switch (mayorSortBy) {
                case 'fecha':
                    return (new Date(a.fecha || 0).getTime() - new Date(b.fecha || 0).getTime()) * dir;
                case 'numero':
                    return (a.numero || '').localeCompare(b.numero || '', 'es', { numeric: true }) * dir;
                case 'tipo':
                    return (a.tipo || '').localeCompare(b.tipo || '', 'es', { sensitivity: 'base' }) * dir;
                case 'concepto':
                    return (a.concepto || '').localeCompare(b.concepto || '', 'es', { sensitivity: 'base' }) * dir;
                case 'debe':
                    return ((a.debe || 0) - (b.debe || 0)) * dir;
                case 'haber':
                    return ((a.haber || 0) - (b.haber || 0)) * dir;
                case 'saldoAcumulado':
                    return ((a.saldoAcumulado || 0) - (b.saldoAcumulado || 0)) * dir;
                default:
                    return 0;
            }
        });
    }, [detalleCliente?.libroMayor, mayorSortBy, mayorSortOrder]);

    const recibosSorted = useMemo(() => {
        const list = detalleCliente?.recibos || [];
        const dir = recibosSortOrder === 'asc' ? 1 : -1;
        return [...list].sort((a: any, b: any) => {
            const montoA = a.haber || a.debe || 0;
            const montoB = b.haber || b.debe || 0;
            const mediosA = Array.isArray(a.mediosPago) && a.mediosPago.length > 0 ? a.mediosPago.map((m: any) => m.metodo).join(' + ') : a.tipo || '';
            const mediosB = Array.isArray(b.mediosPago) && b.mediosPago.length > 0 ? b.mediosPago.map((m: any) => m.metodo).join(' + ') : b.tipo || '';
            switch (recibosSortBy) {
                case 'numero':
                    return (a.numero || '').localeCompare(b.numero || '', 'es', { numeric: true }) * dir;
                case 'fecha':
                    return (new Date(a.fecha || 0).getTime() - new Date(b.fecha || 0).getTime()) * dir;
                case 'concepto':
                    return (a.concepto || '').localeCompare(b.concepto || '', 'es', { sensitivity: 'base' }) * dir;
                case 'mediosPago':
                    return mediosA.localeCompare(mediosB, 'es', { sensitivity: 'base' }) * dir;
                case 'importe':
                    return (montoA - montoB) * dir;
                default:
                    return 0;
            }
        });
    }, [detalleCliente?.recibos, recibosSortBy, recibosSortOrder]);

    const saldoDeudorActual = Math.max(0, detalleCliente?.resumen.saldoActual || 0);
    const saldoAFavorActual = Math.max(0, -(detalleCliente?.resumen.saldoActual || 0));

    return (
        <div className="space-y-4">
            <VentasNavTabs currentTab="cuentas-corrientes" />

            {/* Barra de KPIs Globales */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-card rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-2xs flex items-center justify-between">
                    <div>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            Deuda Activa en Calle
                        </div>
                        <div className="text-2xl font-black font-mono text-slate-900 dark:text-slate-100 mt-0.5">
                            ${fmt(kpis.deudaTotalActiva)}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                            <span className="font-bold text-slate-700 dark:text-slate-300">{kpis.clientesConDeuda}</span> clientes con saldo •{' '}
                            <span className="font-bold text-slate-700 dark:text-slate-300">{kpis.comprobantesPendientesTotal}</span> comp.
                        </div>
                    </div>
                    <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                        <DollarSign className="w-6 h-6" />
                    </div>
                </div>

                <div
                    onClick={() => setFiltro(filtro === 'VENCIDOS' ? 'TODOS' : 'VENCIDOS')}
                    className={`rounded-2xl border p-4 shadow-2xs flex items-center justify-between cursor-pointer transition-all ${
                        filtro === 'VENCIDOS'
                            ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-400 ring-2 ring-amber-400/20'
                            : 'bg-card border-slate-200 dark:border-slate-800 hover:border-amber-300'
                    }`}
                >
                    <div>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                            Clientes con Mora / Vencidos
                        </div>
                        <div className="text-2xl font-black font-mono text-amber-800 dark:text-amber-300 mt-0.5">
                            {kpis.clientesConVencidos}
                        </div>
                        <div className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-1">
                            Click para filtrar cartera vencida
                        </div>
                    </div>
                    <div className="w-11 h-11 rounded-2xl bg-amber-100/80 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
                        <Clock className="w-6 h-6" />
                    </div>
                </div>

                <div className="bg-card rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-2xs flex items-center justify-between">
                    <div>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                            Cobranzas del Mes Actual
                        </div>
                        <div className="text-2xl font-black font-mono text-emerald-700 dark:text-emerald-400 mt-0.5">
                            ${fmt(kpis.cobranzasMesActual)}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                            Recibos confirmados este mes
                        </div>
                    </div>
                    <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-900 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                        <TrendingUp className="w-6 h-6" />
                    </div>
                </div>

                <div
                    onClick={() => setFiltro(filtro === 'EXCEDIDOS' ? 'TODOS' : 'EXCEDIDOS')}
                    className={`rounded-2xl border p-4 shadow-2xs flex items-center justify-between cursor-pointer transition-all ${
                        filtro === 'EXCEDIDOS'
                            ? 'bg-red-50 dark:bg-red-950/30 border-red-400 ring-2 ring-red-400/20'
                            : 'bg-card border-slate-200 dark:border-slate-800 hover:border-red-300'
                    }`}
                >
                    <div>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            Alertas de Límite / Saldos a Favor
                        </div>
                        <div className="text-lg font-black font-mono text-slate-900 dark:text-slate-100 mt-0.5 flex items-center gap-2">
                            <span className={kpis.clientesExcedidosLimite > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-300'}>
                                {kpis.clientesExcedidosLimite} excedidos
                            </span>
                            <span className="text-slate-300 dark:text-slate-700">|</span>
                            <span className="text-emerald-600 dark:text-emerald-400 text-sm">${fmt(kpis.saldoAFavorTotal)} a favor</span>
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                            Control de riesgo crediticio en PDV
                        </div>
                    </div>
                    <div className="w-11 h-11 rounded-2xl bg-red-50 dark:bg-red-950/50 border border-red-100 dark:border-red-900 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                        <ShieldAlert className="w-6 h-6" />
                    </div>
                </div>
            </div>

            {/* Layout Principal: Cartera de Clientes (Izquierda) + Detalle Cuenta Corriente (Derecha) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                {/* Columna Izquierda: Cartera de Clientes */}
                <div className="lg:col-span-4 bg-card rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden flex flex-col max-h-[760px]">
                    <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 space-y-2.5 bg-slate-50/50 dark:bg-slate-900/40">
                        <div className="flex items-center justify-between gap-2">
                            <h2 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5 whitespace-nowrap">
                                <UserCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                Cartera ({clientesFiltrados.length})
                            </h2>
                            <div className="flex items-center gap-1.5">
                                <select
                                    value={ordenCartera}
                                    onChange={(e) => setOrdenCartera(e.target.value as OrdenCartera)}
                                    className="px-2 py-1 text-[11px] font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-card text-slate-700 dark:text-slate-200 focus:outline-none"
                                    title="Ordenar cartera de clientes"
                                >
                                    <option value="MAYOR_DEUDA">Mayor Deuda</option>
                                    <option value="MAYOR_MORA">Mayor Mora</option>
                                    <option value="NOMBRE_ASC">Nombre A-Z</option>
                                </select>
                                <button
                                    onClick={handleRefreshTodo}
                                    className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
                                    title="Actualizar saldos"
                                >
                                    <RefreshCw className={`w-3.5 h-3.5 ${loadingCartera ? 'animate-spin' : ''}`} />
                                </button>
                            </div>
                        </div>

                        {/* Buscador */}
                        <div className="relative">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                placeholder="Buscar cliente por nombre, teléfono o email..."
                                value={busqueda}
                                onChange={(e) => setBusqueda(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Escape' && busqueda) {
                                        e.stopPropagation();
                                        setBusqueda('');
                                    }
                                }}
                                className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-card text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            {busqueda && (
                                <button
                                    type="button"
                                    onClick={() => setBusqueda('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded"
                                    title="Limpiar búsqueda (Esc)"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        {/* Chips de filtro */}
                        <div className="flex flex-wrap gap-1">
                            {(
                                [
                                    { id: 'TODOS', label: 'Todos' },
                                    { id: 'CON_DEUDA', label: 'Con Deuda' },
                                    { id: 'VENCIDOS', label: 'En Mora' },
                                    { id: 'EXCEDIDOS', label: 'Excedidos' },
                                    { id: 'SALDO_FAVOR', label: 'A Favor' },
                                    { id: 'SUSPENDIDOS', label: 'Suspendidos' },
                                ] as Array<{ id: FiltroCartera; label: string }>
                            ).map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setFiltro(tab.id)}
                                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors whitespace-nowrap ${
                                        filtro === tab.id
                                            ? 'bg-indigo-600 text-white shadow-2xs'
                                            : 'bg-card border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Lista de clientes */}
                    <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
                        {loadingCartera && clientes.length === 0 ? (
                            <div className="p-8 text-center text-xs text-slate-400">Cargando cartera de clientes...</div>
                        ) : clientesFiltrados.length === 0 ? (
                            <div className="p-8 text-center text-xs text-slate-400">
                                No se encontraron clientes con el criterio seleccionado.
                            </div>
                        ) : (
                            clientesFiltrados.map((cli) => {
                                const isSelected = cli.id === selectedClienteId;
                                const limite = cli.config.limiteCredito || 0;
                                const pctLimite =
                                    limite > 0
                                        ? Math.min(100, Math.round((Math.max(0, cli.saldoActual) / limite) * 100))
                                        : 0;
                                const excede = limite > 0 && cli.saldoActual > limite + 0.01;

                                return (
                                    <button
                                        key={cli.id}
                                        onClick={() => setSelectedClienteId(cli.id)}
                                        className={`w-full text-left p-3.5 transition-all flex items-start justify-between gap-2 ${
                                            isSelected
                                                ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-l-4 border-l-indigo-600'
                                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                                        }`}
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5">
                                                <span className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                                                    {cli.nombre}
                                                </span>
                                                {cli.config.estadoCredito === 'SUSPENDIDO' && (
                                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400">
                                                        Susp.
                                                    </span>
                                                )}
                                                {cli.config.estadoCredito === 'OBSERVADO' && (
                                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400">
                                                        Obs.
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                                                {cli.telefono ? <span>{cli.telefono}</span> : <span>Cliente activo</span>}
                                                {cli.comprobantesPendientes > 0 && (
                                                    <span>• {cli.comprobantesPendientes} comp.</span>
                                                )}
                                            </div>

                                            {cli.deudaVencida > 0.01 && (
                                                <div className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100/80 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                                                    <AlertTriangle className="w-3 h-3" />
                                                    Vencido: ${fmt(cli.deudaVencida)} ({cli.diasMoraMax}d)
                                                </div>
                                            )}

                                            {limite > 0 && (
                                                <div className="mt-1.5">
                                                    <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full ${
                                                                excede
                                                                    ? 'bg-red-500'
                                                                    : pctLimite >= 80
                                                                    ? 'bg-amber-500'
                                                                    : 'bg-indigo-500'
                                                            }`}
                                                            style={{ width: `${pctLimite}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div className="text-right shrink-0">
                                            {cli.saldoActual > 0.01 ? (
                                                <>
                                                    <div className="text-xs font-black font-mono text-slate-900 dark:text-slate-100">
                                                        ${fmt(cli.saldoActual)}
                                                    </div>
                                                    <div className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold">
                                                        Saldo Deudor
                                                    </div>
                                                </>
                                            ) : cli.saldoActual < -0.01 ? (
                                                <>
                                                    <div className="text-xs font-black font-mono text-emerald-700 dark:text-emerald-400">
                                                        ${fmt(Math.abs(cli.saldoActual))}
                                                    </div>
                                                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                                                        Saldo a Favor
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="text-xs font-mono font-bold text-slate-400">$0,00</div>
                                                    <div className="text-[10px] text-slate-400">Al día</div>
                                                </>
                                            )}
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Columna Derecha: Detalle de Cuenta Corriente del Cliente */}
                <div className="lg:col-span-8 space-y-4 min-w-0">
                    {!selectedClienteId || !detalleCliente ? (
                        <div className="bg-card rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-400">
                            {loadingDetalle ? (
                                <span>Cargando ficha de cuenta corriente...</span>
                            ) : (
                                <span>Seleccione un cliente de la cartera izquierda para gestionar su Cuenta Corriente.</span>
                            )}
                        </div>
                    ) : (
                        <>
                            {/* Ficha Superior del Cliente y Acciones */}
                            <div className="bg-card rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs space-y-4">
                                <div className="flex flex-wrap items-start justify-between gap-4">
                                    <div>
                                        <div className="flex items-center gap-2.5 flex-wrap">
                                            <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                                                {detalleCliente.cliente.nombre}
                                            </h2>
                                            <span
                                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border whitespace-nowrap ${
                                                    detalleCliente.cliente.config.estadoCredito === 'SUSPENDIDO'
                                                        ? 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800'
                                                        : detalleCliente.cliente.config.estadoCredito === 'OBSERVADO'
                                                        ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                                                        : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                                }`}
                                            >
                                                Crédito {detalleCliente.cliente.config.estadoCredito}
                                            </span>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-1.5">
                                            {detalleCliente.cliente.telefono && (
                                                <span className="inline-flex items-center gap-1">
                                                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                                                    {detalleCliente.cliente.telefono}
                                                </span>
                                            )}
                                            {detalleCliente.cliente.email && (
                                                <span className="inline-flex items-center gap-1">
                                                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                                                    {detalleCliente.cliente.email}
                                                </span>
                                            )}
                                            {detalleCliente.cliente.direccion && (
                                                <span>{detalleCliente.cliente.direccion}</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Botonera Principal */}
                                    <div className="flex flex-wrap items-center gap-2">
                                        <button
                                            onClick={() => setShowCobranzaModal(true)}
                                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all whitespace-nowrap"
                                        >
                                            <DollarSign className="w-4 h-4 shrink-0" />
                                            Registrar Cobranza / Recibo
                                        </button>

                                        <button
                                            onClick={() => setShowAjusteModal(true)}
                                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition-colors whitespace-nowrap"
                                        >
                                            <FilePlus2 className="w-4 h-4 shrink-0" />
                                            Nota Déb. / Créd. / Ajuste
                                        </button>

                                        <button
                                            onClick={() => setShowEstadoCuentaModal(true)}
                                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-card hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors whitespace-nowrap"
                                            title="Imprimir Resumen de Cuenta"
                                        >
                                            <Printer className="w-4 h-4 text-slate-500 shrink-0" />
                                            Estado de Cuenta
                                        </button>

                                        <button
                                            onClick={() => setShowConfigModal(true)}
                                            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors shrink-0"
                                            title="Configurar Límite y Plazo de Crédito"
                                        >
                                            <Settings2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* Métricas del Cliente */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                                    <div
                                        className={`p-3 rounded-xl border ${
                                            saldoDeudorActual > 0
                                                ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'
                                                : saldoAFavorActual > 0
                                                ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
                                                : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800'
                                        }`}
                                    >
                                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                            {saldoAFavorActual > 0 ? 'Saldo a Favor' : 'Saldo Deudor Actual'}
                                        </div>
                                        <div
                                            className={`text-lg font-black font-mono mt-0.5 ${
                                                saldoDeudorActual > 0
                                                    ? 'text-slate-900 dark:text-slate-100'
                                                    : saldoAFavorActual > 0
                                                    ? 'text-emerald-700 dark:text-emerald-400'
                                                    : 'text-slate-400'
                                            }`}
                                        >
                                            ${fmt(saldoAFavorActual > 0 ? saldoAFavorActual : saldoDeudorActual)}
                                        </div>
                                    </div>

                                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                            Deuda Vencida ({detalleCliente.cliente.config.plazoDias}d)
                                        </div>
                                        <div
                                            className={`text-lg font-black font-mono mt-0.5 ${
                                                detalleCliente.resumen.deudaVencida > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-300'
                                            }`}
                                        >
                                            ${fmt(detalleCliente.resumen.deudaVencida)}
                                        </div>
                                        {detalleCliente.resumen.diasMoraMaxima > 0 && (
                                            <div className="text-[10px] text-red-600 dark:text-red-400 font-bold">
                                                Mora máx: {detalleCliente.resumen.diasMoraMaxima} días
                                            </div>
                                        )}
                                    </div>

                                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                            Límite de Crédito
                                        </div>
                                        <div className="text-lg font-black font-mono text-slate-800 dark:text-slate-200 mt-0.5">
                                            {detalleCliente.cliente.config.limiteCredito > 0
                                                ? `$${fmt(detalleCliente.cliente.config.limiteCredito)}`
                                                : 'Sin Tope'}
                                        </div>
                                        {detalleCliente.cliente.config.limiteCredito > 0 && (
                                            <div
                                                className={`text-[10px] font-bold ${
                                                    saldoDeudorActual > detalleCliente.cliente.config.limiteCredito
                                                        ? 'text-red-600 dark:text-red-400'
                                                        : 'text-emerald-700 dark:text-emerald-400'
                                                }`}
                                            >
                                                {saldoDeudorActual > detalleCliente.cliente.config.limiteCredito
                                                    ? 'Excedido de límite'
                                                    : `Disponible: $${fmt(detalleCliente.resumen.disponibleCredito || 0)}`}
                                            </div>
                                        )}
                                    </div>

                                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                            Total Histórico Operado
                                        </div>
                                        <div className="text-sm font-mono font-bold text-slate-800 dark:text-slate-200 mt-1">
                                            Cargos: ${fmt(detalleCliente.resumen.totalDebe)}
                                        </div>
                                        <div className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 font-semibold">
                                            Pagos: ${fmt(detalleCliente.resumen.totalHaber)}
                                        </div>
                                    </div>
                                </div>

                                {detalleCliente.cliente.config.observaciones && (
                                    <div className="px-3.5 py-2 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900 text-xs text-indigo-900 dark:text-indigo-200">
                                        <strong className="font-bold">Acuerdo comercial:</strong>{' '}
                                        {detalleCliente.cliente.config.observaciones}
                                    </div>
                                )}
                            </div>

                            {/* Sub-pestañas del Detalle */}
                            <div className="bg-card rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
                                <div className="px-4 pt-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/40 overflow-x-auto no-scrollbar">
                                    <div className="flex items-center gap-1 min-w-max">
                                        <button
                                            onClick={() => setSubTab('PENDIENTES')}
                                            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
                                                subTab === 'PENDIENTES'
                                                    ? 'border-indigo-600 text-indigo-700 dark:text-indigo-400 bg-card rounded-t-xl'
                                                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                            }`}
                                        >
                                            Comprobantes Pendientes ({detalleCliente.comprobantesPendientes.length})
                                        </button>
                                        <button
                                            onClick={() => setSubTab('MAYOR')}
                                            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
                                                subTab === 'MAYOR'
                                                    ? 'border-indigo-600 text-indigo-700 dark:text-indigo-400 bg-card rounded-t-xl'
                                                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                            }`}
                                        >
                                            Libro Mayor / Movimientos ({detalleCliente.libroMayor.length})
                                        </button>
                                        <button
                                            onClick={() => setSubTab('RECIBOS')}
                                            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
                                                subTab === 'RECIBOS'
                                                    ? 'border-indigo-600 text-indigo-700 dark:text-indigo-400 bg-card rounded-t-xl'
                                                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                            }`}
                                        >
                                            Recibos y Notas de Crédito ({detalleCliente.recibos.length})
                                        </button>
                                    </div>
                                </div>

                                {/* Contenido de Sub-pestaña 1: Comprobantes Pendientes */}
                                {subTab === 'PENDIENTES' && (
                                    <div className="p-4">
                                        {comprobantesPendientesSorted.length === 0 ? (
                                            <div className="py-12 text-center text-slate-400 space-y-2">
                                                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                                                <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                                    El cliente no posee comprobantes pendientes de pago
                                                </div>
                                                <p className="text-xs text-slate-400">
                                                    Todas las ventas en cuenta corriente y cargos manuales se encuentran conciliados.
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-xs">
                                                    <thead>
                                                        <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400 select-none">
                                                            <th
                                                                onClick={() => handlePendientesSort('numero')}
                                                                className="py-2.5 px-3 text-left cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 whitespace-nowrap"
                                                            >
                                                                <div className="inline-flex items-center gap-1">
                                                                    <span>Comprobante</span>
                                                                    {renderSortIcon(pendientesSortBy, pendientesSortOrder, 'numero')}
                                                                </div>
                                                            </th>
                                                            <th
                                                                onClick={() => handlePendientesSort('fecha')}
                                                                className="py-2.5 px-3 text-left cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 whitespace-nowrap"
                                                            >
                                                                <div className="inline-flex items-center gap-1">
                                                                    <span>Emisión</span>
                                                                    {renderSortIcon(pendientesSortBy, pendientesSortOrder, 'fecha')}
                                                                </div>
                                                            </th>
                                                            <th
                                                                onClick={() => handlePendientesSort('fechaVencimiento')}
                                                                className="py-2.5 px-3 text-left cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 whitespace-nowrap"
                                                            >
                                                                <div className="inline-flex items-center gap-1">
                                                                    <span>Vencimiento</span>
                                                                    {renderSortIcon(pendientesSortBy, pendientesSortOrder, 'fechaVencimiento')}
                                                                </div>
                                                            </th>
                                                            <th
                                                                onClick={() => handlePendientesSort('concepto')}
                                                                className="py-2.5 px-3 text-left cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 whitespace-nowrap"
                                                            >
                                                                <div className="inline-flex items-center gap-1">
                                                                    <span>Concepto / Detalle</span>
                                                                    {renderSortIcon(pendientesSortBy, pendientesSortOrder, 'concepto')}
                                                                </div>
                                                            </th>
                                                            <th
                                                                onClick={() => handlePendientesSort('montoOriginalCC')}
                                                                className="py-2.5 px-3 text-right cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 whitespace-nowrap"
                                                            >
                                                                <div className="inline-flex items-center justify-end gap-1">
                                                                    <span>Total Orig.</span>
                                                                    {renderSortIcon(pendientesSortBy, pendientesSortOrder, 'montoOriginalCC')}
                                                                </div>
                                                            </th>
                                                            <th
                                                                onClick={() => handlePendientesSort('montoPagadoCC')}
                                                                className="py-2.5 px-3 text-right cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 whitespace-nowrap"
                                                            >
                                                                <div className="inline-flex items-center justify-end gap-1">
                                                                    <span>Pagado</span>
                                                                    {renderSortIcon(pendientesSortBy, pendientesSortOrder, 'montoPagadoCC')}
                                                                </div>
                                                            </th>
                                                            <th
                                                                onClick={() => handlePendientesSort('saldoPendiente')}
                                                                className="py-2.5 px-3 text-right cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 whitespace-nowrap"
                                                            >
                                                                <div className="inline-flex items-center justify-end gap-1">
                                                                    <span>Saldo Pendiente</span>
                                                                    {renderSortIcon(pendientesSortBy, pendientesSortOrder, 'saldoPendiente')}
                                                                </div>
                                                            </th>
                                                            <th className="py-2.5 px-3 text-right whitespace-nowrap">Acciones</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                                                        {comprobantesPendientesSorted.map((comp) => (
                                                            <tr key={comp.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                                                                <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                                                                    {comp.numero}
                                                                </td>
                                                                <td className="py-3 px-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                                                    {fmtDate(comp.fecha)}
                                                                </td>
                                                                <td className="py-3 px-3 whitespace-nowrap">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className="text-slate-700 dark:text-slate-300">
                                                                            {fmtDate(comp.fechaVencimiento)}
                                                                        </span>
                                                                        {comp.vencido ? (
                                                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400">
                                                                                +{comp.diasVencido}d mora
                                                                            </span>
                                                                        ) : (
                                                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400">
                                                                                En plazo
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td className="py-3 px-3 text-slate-600 dark:text-slate-300 max-w-xs truncate">
                                                                    {comp.concepto}
                                                                </td>
                                                                <td className="py-3 px-3 text-right font-mono text-slate-500 whitespace-nowrap">
                                                                    ${fmt(comp.montoOriginalCC)}
                                                                </td>
                                                                <td className="py-3 px-3 text-right font-mono text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                                                                    ${fmt(comp.montoPagadoCC)}
                                                                </td>
                                                                <td className="py-3 px-3 text-right font-mono font-black text-amber-800 dark:text-amber-300 text-sm whitespace-nowrap">
                                                                    ${fmt(comp.saldoPendiente)}
                                                                </td>
                                                                <td className="py-3 px-3 text-right whitespace-nowrap">
                                                                    <div className="inline-flex items-center gap-1">
                                                                        {comp.destinoTipo === 'VENTA' && (
                                                                            <button
                                                                                onClick={() => handleVerVenta(comp.id)}
                                                                                className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors"
                                                                                title="Ver comprobante de venta"
                                                                            >
                                                                                <Eye className="w-4 h-4" />
                                                                            </button>
                                                                        )}
                                                                        <button
                                                                            onClick={() => setShowCobranzaModal(true)}
                                                                            className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-400 font-bold text-[11px] transition-colors whitespace-nowrap"
                                                                        >
                                                                            Cobrar
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Contenido de Sub-pestaña 2: Libro Mayor */}
                                {subTab === 'MAYOR' && (
                                    <div className="p-4">
                                        {libroMayorSorted.length === 0 ? (
                                            <div className="py-12 text-center text-xs text-slate-400">
                                                No se registran movimientos históricos en la cuenta corriente de este cliente.
                                            </div>
                                        ) : (
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-xs">
                                                    <thead>
                                                        <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400 select-none">
                                                            <th
                                                                onClick={() => handleMayorSort('fecha')}
                                                                className="py-2.5 px-3 text-left cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 whitespace-nowrap"
                                                            >
                                                                <div className="inline-flex items-center gap-1">
                                                                    <span>Fecha</span>
                                                                    {renderSortIcon(mayorSortBy, mayorSortOrder, 'fecha')}
                                                                </div>
                                                            </th>
                                                            <th
                                                                onClick={() => handleMayorSort('numero')}
                                                                className="py-2.5 px-3 text-left cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 whitespace-nowrap"
                                                            >
                                                                <div className="inline-flex items-center gap-1">
                                                                    <span>Comprobante</span>
                                                                    {renderSortIcon(mayorSortBy, mayorSortOrder, 'numero')}
                                                                </div>
                                                            </th>
                                                            <th
                                                                onClick={() => handleMayorSort('tipo')}
                                                                className="py-2.5 px-3 text-left cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 whitespace-nowrap"
                                                            >
                                                                <div className="inline-flex items-center gap-1">
                                                                    <span>Tipo</span>
                                                                    {renderSortIcon(mayorSortBy, mayorSortOrder, 'tipo')}
                                                                </div>
                                                            </th>
                                                            <th
                                                                onClick={() => handleMayorSort('concepto')}
                                                                className="py-2.5 px-3 text-left cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 whitespace-nowrap"
                                                            >
                                                                <div className="inline-flex items-center gap-1">
                                                                    <span>Concepto / Detalle</span>
                                                                    {renderSortIcon(mayorSortBy, mayorSortOrder, 'concepto')}
                                                                </div>
                                                            </th>
                                                            <th
                                                                onClick={() => handleMayorSort('debe')}
                                                                className="py-2.5 px-3 text-right cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 whitespace-nowrap"
                                                            >
                                                                <div className="inline-flex items-center justify-end gap-1">
                                                                    <span>Debe (+)</span>
                                                                    {renderSortIcon(mayorSortBy, mayorSortOrder, 'debe')}
                                                                </div>
                                                            </th>
                                                            <th
                                                                onClick={() => handleMayorSort('haber')}
                                                                className="py-2.5 px-3 text-right cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 whitespace-nowrap"
                                                            >
                                                                <div className="inline-flex items-center justify-end gap-1">
                                                                    <span>Haber (-)</span>
                                                                    {renderSortIcon(mayorSortBy, mayorSortOrder, 'haber')}
                                                                </div>
                                                            </th>
                                                            <th
                                                                onClick={() => handleMayorSort('saldoAcumulado')}
                                                                className="py-2.5 px-3 text-right cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 whitespace-nowrap"
                                                            >
                                                                <div className="inline-flex items-center justify-end gap-1">
                                                                    <span>Saldo Acum.</span>
                                                                    {renderSortIcon(mayorSortBy, mayorSortOrder, 'saldoAcumulado')}
                                                                </div>
                                                            </th>
                                                            <th className="py-2.5 px-3 text-right whitespace-nowrap">Acciones</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                                                        {libroMayorSorted.map((row: any) => {
                                                            const isAnulado =
                                                                row.estado === 'ANULADO' || row.estado === 'ANULADA';
                                                            const realMovId = row.movimiento?.id || row.venta?.id;

                                                            return (
                                                                <tr
                                                                    key={row.id}
                                                                    className={`${
                                                                        isAnulado
                                                                            ? 'opacity-45 line-through bg-slate-50 dark:bg-slate-900/40'
                                                                            : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                                                                    }`}
                                                                >
                                                                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                                                        {fmtDate(row.fecha)}
                                                                    </td>
                                                                    <td className="py-2.5 px-3 font-mono font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                                                                        {row.numero}
                                                                    </td>
                                                                    <td className="py-2.5 px-3 whitespace-nowrap">
                                                                        <span
                                                                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                                                row.debe > 0
                                                                                    ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                                                                                    : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                                                            }`}
                                                                        >
                                                                            {row.tipo}
                                                                        </span>
                                                                    </td>
                                                                    <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 max-w-xs">
                                                                        <div className="truncate">{row.concepto}</div>
                                                                        {row.observaciones && (
                                                                            <div className="text-[10px] text-slate-400 truncate">
                                                                                {row.observaciones}
                                                                            </div>
                                                                        )}
                                                                    </td>
                                                                    <td className="py-2.5 px-3 text-right font-mono text-amber-800 dark:text-amber-300 whitespace-nowrap">
                                                                        {row.debe > 0 ? `$${fmt(row.debe)}` : '—'}
                                                                    </td>
                                                                    <td className="py-2.5 px-3 text-right font-mono text-emerald-700 dark:text-emerald-400 font-semibold whitespace-nowrap">
                                                                        {row.haber > 0 ? `$${fmt(row.haber)}` : '—'}
                                                                    </td>
                                                                    <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900 dark:text-slate-100 whitespace-nowrap">
                                                                        ${fmt(row.saldoAcumulado)}
                                                                    </td>
                                                                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                                                        {row.origen === 'VENTA' ? (
                                                                            <button
                                                                                onClick={() =>
                                                                                    row.venta?.id && handleVerVenta(row.venta.id)
                                                                                }
                                                                                className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50"
                                                                                title="Ver venta original"
                                                                            >
                                                                                <Eye className="w-4 h-4" />
                                                                            </button>
                                                                        ) : (
                                                                            <div className="inline-flex items-center gap-1">
                                                                                {(row.tipo === 'RECIBO_PAGO' ||
                                                                                    row.tipo === 'NOTA_CREDITO') &&
                                                                                    row.movimiento && (
                                                                                        <button
                                                                                            onClick={() =>
                                                                                                setReciboImprimir(
                                                                                                    row.movimiento
                                                                                                )
                                                                                            }
                                                                                            className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50"
                                                                                            title="Imprimir Recibo / Nota de Crédito"
                                                                                        >
                                                                                            <Printer className="w-4 h-4" />
                                                                                        </button>
                                                                                    )}
                                                                                {!isAnulado && realMovId && (
                                                                                    <button
                                                                                        onClick={() =>
                                                                                            setMovimientoAnular({
                                                                                                id: realMovId,
                                                                                                numero: row.numero,
                                                                                                concepto: row.concepto,
                                                                                                monto:
                                                                                                    row.debe > 0
                                                                                                        ? row.debe
                                                                                                        : row.haber,
                                                                                            })
                                                                                        }
                                                                                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50"
                                                                                        title="Anular movimiento"
                                                                                    >
                                                                                        <Ban className="w-4 h-4" />
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Contenido de Sub-pestaña 3: Recibos Emitidos */}
                                {subTab === 'RECIBOS' && (
                                    <div className="p-4">
                                        {recibosSorted.length === 0 ? (
                                            <div className="py-12 text-center text-xs text-slate-400">
                                                Aún no se han emitido recibos de cobranza ni notas de crédito para este cliente.
                                            </div>
                                        ) : (
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-xs">
                                                    <thead>
                                                        <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400 select-none">
                                                            <th
                                                                onClick={() => handleRecibosSort('numero')}
                                                                className="py-2.5 px-3 text-left cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 whitespace-nowrap"
                                                            >
                                                                <div className="inline-flex items-center gap-1">
                                                                    <span>N° Comprobante</span>
                                                                    {renderSortIcon(recibosSortBy, recibosSortOrder, 'numero')}
                                                                </div>
                                                            </th>
                                                            <th
                                                                onClick={() => handleRecibosSort('fecha')}
                                                                className="py-2.5 px-3 text-left cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 whitespace-nowrap"
                                                            >
                                                                <div className="inline-flex items-center gap-1">
                                                                    <span>Fecha</span>
                                                                    {renderSortIcon(recibosSortBy, recibosSortOrder, 'fecha')}
                                                                </div>
                                                            </th>
                                                            <th
                                                                onClick={() => handleRecibosSort('concepto')}
                                                                className="py-2.5 px-3 text-left cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 whitespace-nowrap"
                                                            >
                                                                <div className="inline-flex items-center gap-1">
                                                                    <span>Concepto</span>
                                                                    {renderSortIcon(recibosSortBy, recibosSortOrder, 'concepto')}
                                                                </div>
                                                            </th>
                                                            <th
                                                                onClick={() => handleRecibosSort('mediosPago')}
                                                                className="py-2.5 px-3 text-left cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 whitespace-nowrap"
                                                            >
                                                                <div className="inline-flex items-center gap-1">
                                                                    <span>Medios de Pago</span>
                                                                    {renderSortIcon(recibosSortBy, recibosSortOrder, 'mediosPago')}
                                                                </div>
                                                            </th>
                                                            <th
                                                                onClick={() => handleRecibosSort('importe')}
                                                                className="py-2.5 px-3 text-right cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 whitespace-nowrap"
                                                            >
                                                                <div className="inline-flex items-center justify-end gap-1">
                                                                    <span>Importe</span>
                                                                    {renderSortIcon(recibosSortBy, recibosSortOrder, 'importe')}
                                                                </div>
                                                            </th>
                                                            <th className="py-2.5 px-3 text-right whitespace-nowrap">Acciones</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                                                        {recibosSorted.map((rec: any) => {
                                                            const mediosArr = Array.isArray(rec.mediosPago)
                                                                ? rec.mediosPago
                                                                : [];
                                                            const mediosTexto =
                                                                mediosArr.length > 0
                                                                    ? mediosArr
                                                                          .map((m: any) => m.metodo)
                                                                          .join(' + ')
                                                                    : rec.tipo;
                                                            const montoRec = rec.haber || rec.debe || 0;
                                                            const isAnulado = rec.estado === 'ANULADO';

                                                            return (
                                                                <tr
                                                                    key={rec.id}
                                                                    className={
                                                                        isAnulado
                                                                            ? 'opacity-45 line-through bg-slate-50 dark:bg-slate-900/40'
                                                                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                                                                    }
                                                                >
                                                                    <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                                                                        {rec.numero}
                                                                    </td>
                                                                    <td className="py-3 px-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                                                        {fmtDate(rec.fecha)}
                                                                    </td>
                                                                    <td className="py-3 px-3 text-slate-700 dark:text-slate-300">
                                                                        {rec.concepto}
                                                                    </td>
                                                                    <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                                                                        {mediosTexto}
                                                                    </td>
                                                                    <td className="py-3 px-3 text-right font-mono font-black text-emerald-700 dark:text-emerald-400 text-sm whitespace-nowrap">
                                                                        ${fmt(montoRec)}
                                                                    </td>
                                                                    <td className="py-3 px-3 text-right whitespace-nowrap">
                                                                        <div className="inline-flex items-center gap-1">
                                                                            <button
                                                                                onClick={() => setReciboImprimir(rec)}
                                                                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 font-bold text-[11px] whitespace-nowrap"
                                                                            >
                                                                                <Printer className="w-3.5 h-3.5" />
                                                                                Imprimir Recibo
                                                                            </button>
                                                                            {!isAnulado && (
                                                                                <button
                                                                                    onClick={() =>
                                                                                        setMovimientoAnular({
                                                                                            id: rec.id,
                                                                                            numero: rec.numero,
                                                                                            concepto: rec.concepto,
                                                                                            monto: montoRec,
                                                                                        })
                                                                                    }
                                                                                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50"
                                                                                    title="Anular recibo y revertir imputaciones"
                                                                                >
                                                                                    <Ban className="w-4 h-4" />
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Modales */}
            {showCobranzaModal && detalleCliente && (
                <RegistrarCobranzaModal
                    cliente={{
                        id: detalleCliente.cliente.id,
                        nombre: detalleCliente.cliente.nombre,
                        saldoActual: detalleCliente.resumen.saldoActual,
                        deudaVencida: detalleCliente.resumen.deudaVencida,
                    }}
                    comprobantesPendientes={detalleCliente.comprobantesPendientes}
                    onClose={() => setShowCobranzaModal(false)}
                    onSuccess={async (reciboCreado) => {
                        setShowCobranzaModal(false);
                        await handleRefreshTodo();
                        setReciboImprimir(reciboCreado);
                    }}
                />
            )}

            {showAjusteModal && detalleCliente && (
                <RegistrarAjusteCCModal
                    cliente={{
                        id: detalleCliente.cliente.id,
                        name: detalleCliente.cliente.nombre,
                        saldoDeudor: saldoDeudorActual,
                    }}
                    onClose={() => setShowAjusteModal(false)}
                    onSuccess={async () => {
                        setShowAjusteModal(false);
                        await handleRefreshTodo();
                    }}
                />
            )}

            {showConfigModal && detalleCliente && (
                <ConfigCreditoModal
                    cliente={{
                        id: detalleCliente.cliente.id,
                        name: detalleCliente.cliente.nombre,
                    }}
                    configActual={detalleCliente.cliente.config}
                    onClose={() => setShowConfigModal(false)}
                    onSuccess={async () => {
                        setShowConfigModal(false);
                        await handleRefreshTodo();
                    }}
                />
            )}

            <ImprimirReciboCCModal
                isOpen={!!reciboImprimir}
                movimiento={reciboImprimir}
                cliente={detalleCliente?.cliente}
                onClose={() => setReciboImprimir(null)}
            />

            <ImprimirEstadoCuentaModal
                isOpen={showEstadoCuentaModal}
                detalleCliente={detalleCliente}
                onClose={() => setShowEstadoCuentaModal(false)}
            />

            {ventaVerModal && (
                <ComprobanteModal
                    isOpen={!!ventaVerModal}
                    venta={ventaVerModal}
                    onClose={() => setVentaVerModal(null)}
                />
            )}

            {/* Modal de Confirmación de Anulación */}
            {movimientoAnular && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-card rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden">
                        <div className="px-6 py-4 bg-red-600 text-white flex items-center justify-between">
                            <h3 className="font-black text-sm">Anular Movimiento {movimientoAnular.numero}</h3>
                            <button
                                onClick={() => {
                                    setMovimientoAnular(null);
                                    setSupervisorPinAnulacion('');
                                }}
                                className="text-white/80 hover:text-white"
                            >
                                ✕
                            </button>
                        </div>
                        <form onSubmit={handleConfirmarAnulacion} className="p-6 space-y-4">
                            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                                Está por anular el comprobante <strong>{movimientoAnular.numero}</strong> (
                                {movimientoAnular.concepto}) por <strong>${fmt(movimientoAnular.monto)}</strong>. Si tenía facturas imputadas, el saldo pendiente de dichas facturas será restaurado automáticamente.
                            </p>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Motivo de anulación *
                                </label>
                                <input
                                    type="text"
                                    required
                                    minLength={3}
                                    placeholder="Ej: Error en carga de importe / Cheque rechazado"
                                    value={motivoAnulacion}
                                    onChange={(e) => setMotivoAnulacion(e.target.value)}
                                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-card focus:outline-none focus:ring-2 focus:ring-red-500"
                                />
                            </div>
                            {!esSupervisorOAdmin && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        PIN de Supervisor / Administrador *
                                    </label>
                                    <input
                                        type="password"
                                        required
                                        placeholder="Ingrese PIN de autorización"
                                        value={supervisorPinAnulacion}
                                        onChange={(e) => setSupervisorPinAnulacion(e.target.value)}
                                        className="w-full px-3 py-2 text-xs rounded-xl border border-amber-300 bg-amber-50/40 dark:bg-amber-950/30 focus:outline-none focus:ring-2 focus:ring-amber-500"
                                    />
                                </div>
                            )}
                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setMovimientoAnular(null);
                                        setSupervisorPinAnulacion('');
                                    }}
                                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={
                                        anulando ||
                                        motivoAnulacion.trim().length < 3 ||
                                        (!esSupervisorOAdmin && !supervisorPinAnulacion.trim())
                                    }
                                    className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
                                >
                                    {anulando ? 'Anulando...' : 'Confirmar Anulación'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
