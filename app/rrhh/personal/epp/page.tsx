'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ModuleHeader from '@/components/ModuleHeader';
import { 
    ShieldCheck, 
    Table, 
    Package, 
    Activity, 
    Plus, 
    Camera, 
    UserCheck, 
    AlertTriangle, 
    CheckCircle2, 
    RefreshCw,
    Clock,
    XCircle,
    Share2
} from 'lucide-react';
import { showToast } from '@/components/Toast';
import { 
    getEppMatrix, 
    getEppCatalog, 
    getEppRequests, 
    resolveEppRequest 
} from './actions';
import EppMatrixTable from '@/components/rrhh/EppMatrixTable';
import EppStockManager from '@/components/rrhh/EppStockManager';
import EppOperatorDrawer from '@/components/rrhh/EppOperatorDrawer';
import EppDeliveryModal from '@/components/rrhh/EppDeliveryModal';
import EppShareModal from '@/components/rrhh/EppShareModal';

export default function EppManagementPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialTab = searchParams.get('tab') || 'matriz';

    const [activeTab, setActiveTab] = useState<string>(initialTab);
    const [loading, setLoading] = useState(true);

    // Datos de la Matriz
    const [operadores, setOperadores] = useState<any[]>([]);
    const [eppGlobales, setEppGlobales] = useState<any[]>([]);
    const [matriz, setMatriz] = useState<Record<string, Record<string, any>>>({});
    const [stats, setStats] = useState<any>(null);

    // Datos de Catálogo y Stock
    const [catalogItems, setCatalogItems] = useState<any[]>([]);

    // Solicitudes
    const [requests, setRequests] = useState<any[]>([]);

    // Modales y Drawers
    const [selectedDrawerOperatorId, setSelectedDrawerOperatorId] = useState<string | null>(null);
    const [deliveryModalOpen, setDeliveryModalOpen] = useState(false);
    const [deliveryPreselectedOpId, setDeliveryPreselectedOpId] = useState<string | null>(null);
    const [shareModalOpen, setShareModalOpen] = useState(false);

    useEffect(() => {
        loadAllData();
    }, []);

    const loadAllData = async (showSpinner = true) => {
        if (showSpinner) setLoading(true);
        try {
            const [matrixRes, catalogRes, requestsRes] = await Promise.allSettled([
                getEppMatrix(),
                getEppCatalog(),
                getEppRequests()
            ]);

            if (matrixRes.status === 'fulfilled' && matrixRes.value.success && matrixRes.value.data) {
                setOperadores(matrixRes.value.data.operadores || []);
                setEppGlobales(matrixRes.value.data.eppGlobales || []);
                setMatriz(matrixRes.value.data.matriz || {});
                setStats(matrixRes.value.data.stats || {});
            }

            if (catalogRes.status === 'fulfilled' && catalogRes.value.success) {
                setCatalogItems(catalogRes.value.data || []);
            }

            if (requestsRes.status === 'fulfilled' && requestsRes.value.success) {
                setRequests(requestsRes.value.data || []);
            }
        } catch (e: any) {
            console.error('Error cargando datos EPP:', e);
            showToast('Error al sincronizar datos de EPP', 'error');
        } finally {
            if (showSpinner) setLoading(false);
        }
    };

    const handleStartDelivery = (operatorId?: string) => {
        setDeliveryPreselectedOpId(operatorId || null);
        setDeliveryModalOpen(true);
    };

    const handleResolveRequest = async (requestId: string, accion: 'APROBAR' | 'RECHAZAR') => {
        try {
            const res = await resolveEppRequest({
                requestId,
                accion,
                resueltoPor: 'Administrador de RRHH'
            });

            if (res.success) {
                showToast(`Solicitud ${accion === 'APROBAR' ? 'aprobada' : 'rechazada'}`, 'success');
                loadAllData();
            } else {
                showToast(res.error || 'Error al resolver solicitud', 'error');
            }
        } catch (e: any) {
            showToast('Error de red', 'error');
        }
    };

    const tabs = [
        { id: 'matriz', label: 'Matriz de Asignación', icon: <Table className="w-4 h-4" /> },
        { id: 'stock', label: 'Stock & Catálogo', icon: <Package className="w-4 h-4" /> },
        { id: 'solicitudes', label: `Solicitudes (${requests.filter(r => r.estado === 'PENDIENTE').length})`, icon: <Activity className="w-4 h-4" /> },
    ];

    return (
        <div className="w-full max-w-[1700px] mx-auto p-3 sm:p-5 md:p-6 space-y-6 animate-in fade-in duration-300">
            {/* Cabecera del Módulo */}
            <ModuleHeader
                title="Elementos de Protección Personal (EPP)"
                description="Matriz de cobertura global, vencimientos, inventario y actas con firma digital"
                icon={<ShieldCheck className="w-6 h-6 text-emerald-600" />}
                tabs={tabs}
                activeTabId={activeTab}
                onTabChange={(id) => {
                    setActiveTab(id);
                    router.push(`/rrhh/personal/epp?tab=${id}`, { scroll: false });
                }}
                actions={[
                    {
                        id: 'refresh',
                        label: 'Actualizar',
                        icon: <RefreshCw className="w-4 h-4" />,
                        variant: 'outline',
                        onClick: loadAllData
                    },
                    {
                        id: 'share-matrix',
                        label: 'Compartir Matriz',
                        icon: <Share2 className="w-4 h-4" />,
                        variant: 'outline',
                        onClick: () => setShareModalOpen(true)
                    },
                    {
                        id: 'new-delivery',
                        label: 'Nueva Entrega',
                        icon: <Plus className="w-4 h-4" />,
                        variant: 'primary',
                        onClick: () => handleStartDelivery()
                    }
                ]}
            />

            {/* Tarjetas de Métricas de Cobertura */}
            {stats && (
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                    <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                            Cobertura Global
                        </span>
                        <div className="flex items-baseline gap-2 mt-1">
                            <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                                {stats.porcentajeCobertura}%
                            </h3>
                            <span className="text-xs text-slate-400 font-medium">al día</span>
                        </div>
                    </div>

                    <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                            EPP Vigentes
                        </span>
                        <div className="flex items-baseline gap-2 mt-1">
                            <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100">
                                {stats.vigentesCount}
                            </h3>
                            <span className="text-xs text-emerald-600 font-bold">cubiertos</span>
                        </div>
                    </div>

                    <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-amber-500 block">
                            Por Vencer (&le; 30d)
                        </span>
                        <div className="flex items-baseline gap-2 mt-1">
                            <h3 className="text-2xl font-black text-amber-600 dark:text-amber-400">
                                {stats.porVencerCount}
                            </h3>
                            <span className="text-xs text-slate-400 font-medium">requieren recambio</span>
                        </div>
                    </div>

                    <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-rose-500 block">
                            EPP Vencidos
                        </span>
                        <div className="flex items-baseline gap-2 mt-1">
                            <h3 className="text-2xl font-black text-rose-600 dark:text-rose-400">
                                {stats.vencidosCount}
                            </h3>
                            <span className="text-xs text-slate-400 font-medium">atención urgente</span>
                        </div>
                    </div>

                    <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs col-span-2 lg:col-span-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                            Ptes. de Firma
                        </span>
                        <div className="flex items-baseline gap-2 mt-1">
                            <h3 className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                                {stats.pendientesFirmaCount}
                            </h3>
                            <span className="text-xs text-slate-400 font-medium">en Mis EPP</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Contenido según pestaña */}
            {loading ? (
                <div className="py-20 text-center text-slate-400">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-emerald-500" />
                    <span className="text-xs font-medium">Cargando datos de EPP...</span>
                </div>
            ) : (
                <>
                    {activeTab === 'matriz' && (
                        <EppMatrixTable
                            operadores={operadores}
                            eppGlobales={eppGlobales}
                            matriz={matriz}
                            onSelectOperator={(opId) => setSelectedDrawerOperatorId(opId)}
                            onStartDelivery={(opId) => handleStartDelivery(opId)}
                        />
                    )}

                    {activeTab === 'stock' && (
                        <EppStockManager
                            items={catalogItems}
                            onRefresh={() => loadAllData(false)}
                        />
                    )}

                    {activeTab === 'solicitudes' && (
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm p-6 space-y-4">
                            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
                                <div>
                                    <h3 className="font-black text-slate-900 dark:text-slate-100 text-base">
                                        Solicitudes de EPP Realizadas por Operadores
                                    </h3>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        Pedidos de reposición por rotura, desgaste o vencimiento próximo
                                    </p>
                                </div>
                            </div>

                            {requests.length === 0 ? (
                                <div className="p-12 text-center text-slate-400 text-xs font-medium">
                                    No hay solicitudes registradas
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {requests.map(req => (
                                        <div
                                            key={req.id}
                                            className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4"
                                        >
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                                                        {req.operator?.nombreCompleto}
                                                    </span>
                                                    <span className="text-xs text-slate-400">
                                                        (DNI: {req.operator?.dni || 'S/D'})
                                                    </span>
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                                        req.estado === 'PENDIENTE'
                                                            ? 'bg-amber-100 text-amber-700'
                                                            : req.estado === 'APROBADA'
                                                            ? 'bg-emerald-100 text-emerald-700'
                                                            : 'bg-rose-100 text-rose-700'
                                                    }`}>
                                                        {req.estado}
                                                    </span>
                                                </div>

                                                <p className="text-xs text-slate-700 dark:text-slate-300">
                                                    Solicitó: <strong>{req.eppItem?.nombre}</strong> {req.talle ? `· Talle ${req.talle}` : ''}
                                                </p>

                                                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                                    Motivo: <strong className="uppercase">{req.motivo}</strong> · {req.comentario ? `"${req.comentario}"` : 'Sin comentario'} · Fecha: {new Date(req.fechaSolicitud).toLocaleString()}
                                                </p>
                                            </div>

                                            {req.estado === 'PENDIENTE' && (
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => handleResolveRequest(req.id, 'RECHAZAR')}
                                                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                                                    >
                                                        <XCircle className="w-3.5 h-3.5" />
                                                        Rechazar
                                                    </button>

                                                    <button
                                                        onClick={() => {
                                                            handleResolveRequest(req.id, 'APROBAR');
                                                            handleStartDelivery(req.operatorId);
                                                        }}
                                                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-sm"
                                                    >
                                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                                        Aprobar y Despachar
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            {/* Drawer Lateral del Operador */}
            <EppOperatorDrawer
                operatorId={selectedDrawerOperatorId}
                onClose={() => setSelectedDrawerOperatorId(null)}
                onStartDelivery={(opId) => {
                    setSelectedDrawerOperatorId(null);
                    handleStartDelivery(opId);
                }}
            />

            {/* Modal de Despacho de Entrega */}
            <EppDeliveryModal
                isOpen={deliveryModalOpen}
                onClose={() => setDeliveryModalOpen(false)}
                onDeliveryCreated={loadAllData}
                preselectedOperatorId={deliveryPreselectedOpId}
                operadores={operadores}
                eppGlobales={eppGlobales}
                matriz={matriz}
            />

            {/* Modal de Compartir Matriz */}
            <EppShareModal
                isOpen={shareModalOpen}
                onClose={() => setShareModalOpen(false)}
            />
        </div>
    );
}
